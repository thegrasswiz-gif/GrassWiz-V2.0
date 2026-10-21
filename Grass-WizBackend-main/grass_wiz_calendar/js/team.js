// Team tab: employee cards, add/edit employee, profile modal


window.fetchTechnicians = async function() {
  try {
    technicians = await sbFetchTechnicians();
    renderTeam();
    const techSelect = $('technician');
    const keep = techSelect.value;
    techSelect.innerHTML = '<option value="">-- Assign Tech --</option>';
    technicians.filter(t => t.employment_status !== 'Terminated').forEach(t => {
      const opt = document.createElement('option');
      opt.value = opt.textContent = t.name;      // textContent: names with quotes or < > are safe
      techSelect.appendChild(opt);
    });
    techSelect.value = keep;
  } catch (err) { if (handleAuthError(err)) return; console.error("Error fetching technicians:", err); showAppError(describeLoadError(err)); renderTeam(); }
};

function renderTeam() {
  const grid = $('teamGrid');
  grid.innerHTML = '';
  if (!technicians.length) {
    grid.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:40px; color:var(--text-muted);">No employees found. Click "Add Employee" to start.</div>';
    return;
  }
  technicians.forEach(t => {
    let card = document.createElement('div');
    card.className = 'employee-card';
    let badgeClass = 'badge-' + String(t.employment_status || '').replace(' ', '-');
    card.innerHTML = `
      <div class="employee-header">
        <div>
          <h3>${esc(t.name)}</h3>
          <span class="employee-dept">${esc(t.department) || 'No Dept'}</span>
        </div>
        <span class="employee-badge ${esc(badgeClass)}">${esc(t.employment_status)}</span>
      </div>
      <div style="font-size:12px; color:var(--text-muted); margin-top:8px;">
        📞 ${esc(t.phone) || 'N/A'}
      </div>
      <div class="quick-actions">
        <button class="small primary btn-present"><i class="fas fa-check"></i> Present</button>
        <button class="small danger btn-absent"><i class="fas fa-times"></i> Absent</button>
        <button class="small secondary btn-profile"><i class="fas fa-user"></i> Profile</button>
      </div>
    `;
    // Listeners instead of inline onclick="..." so names like O'Brien can't break (or inject into) the handler
    const on = (sel, fn) => card.querySelector(sel).addEventListener('click', (e) => { e.stopPropagation(); fn(); });
    on('.btn-present', () => quickAttendance(t.id, t.name, 'Present'));
    on('.btn-absent',  () => quickAttendance(t.id, t.name, 'Absent (Unpaid)'));
    on('.btn-profile', () => openProfile(t.id));
    card.onclick = () => openProfile(t.id);
    grid.appendChild(card);
  });
}

window.toggleTerminationFields = () => {
  let isTerminated = $('empStatus').value === 'Terminated';
  $('terminationFields').classList.toggle('hidden', !isTerminated);
};

window.openEditEmployee = () => {
  if(!activeEmployee) return;
  $('empId').value = activeEmployee.id;
  $('empName').value = activeEmployee.name;
  $('empPhone').value = activeEmployee.phone || '';
  $('empEmail').value = activeEmployee.email || '';
  $('empAddress').value = activeEmployee.address || '';
  $('empDept').value = activeEmployee.department || 'Landscape';
  $('empStatus').value = activeEmployee.employment_status;
  $('empHireDate').value = activeEmployee.hire_date ? activeEmployee.hire_date.split('T')[0] : todayISO();
  $('empProbationEnd').value = activeEmployee.probation_end_date ? activeEmployee.probation_end_date.split('T')[0] : '';
  $('empRate').value = activeEmployee.base_monthly_rate;
  $('empNis').value = activeEmployee.nis || '';
  $('empTrn').value = activeEmployee.trn || '';
  $('empLicense').value = activeEmployee.license_number || '';
  $('empNotes').value = activeEmployee.notes || '';
  
  $('empTerminationReason').value = activeEmployee.termination_reason || '';
  $('empTerminationDate').value = activeEmployee.termination_date ? activeEmployee.termination_date.split('T')[0] : '';
  $('empRehire').value = activeEmployee.rehire_eligible ? 'true' : 'false';

  $('empDocument').value = '';   // don't re-upload a file picked in an earlier, cancelled edit
  toggleTerminationFields();
  $('employeeModalTitle').textContent = 'Edit Employee';
  $('employeeModalBack').classList.add('open');
  $('profileModalBack').classList.remove('open');
};

window.quickAttendance = async (techId, techName, status) => {
  if (!confirm(`Mark ${techName} as ${status.toUpperCase()} for today?`)) return;
  try {
    await sbSaveAttendance({ id: makeId(), tech_id: techId, date: todayISO(), status: status });
    alert(`${techName} marked ${status.toLowerCase()}!`);
  } catch (err) { alert('Error marking attendance.'); }
};

window.openProfile = async (techId) => {
  activeEmployee = technicians.find(t => t.id === techId);
  if (!activeEmployee) return;
  
  $('profName').textContent = activeEmployee.name;
  $('profStatus').textContent = activeEmployee.employment_status;
  $('profStatus').className = 'employee-badge badge-' + activeEmployee.employment_status.replace(' ', '-');
  $('profDept').textContent = activeEmployee.department || 'No Department';
  $('profPhone').textContent = activeEmployee.phone || 'N/A';
  $('profEmail').textContent = activeEmployee.email || 'N/A';
  $('profAddress').textContent = activeEmployee.address || 'N/A';
  $('profRate').textContent = Number(activeEmployee.base_monthly_rate).toLocaleString();
  $('profNis').textContent = activeEmployee.nis || 'N/A';
  $('profTrn').textContent = activeEmployee.trn || 'N/A';
  $('profLicense').textContent = activeEmployee.license_number || 'N/A';
  $('profNotes').textContent = activeEmployee.notes || 'None';

  if (activeEmployee.employment_status === 'Terminated') {
    let reason = activeEmployee.termination_reason || 'No reason provided';
    let date = activeEmployee.termination_date ? fmtDate(activeEmployee.termination_date) : 'Unknown Date';
    let rehire = activeEmployee.rehire_eligible ? 'Yes' : 'No';
    $('terminationBanner').textContent = `Terminated on ${date} for ${reason}. Eligible for rehire: ${rehire}.`;
    $('terminationBanner').classList.remove('hidden');
  } else {
    $('terminationBanner').classList.add('hidden');
  }

  const docBtn = $('profViewDocBtn');
  if (activeEmployee.document_path) {
    docBtn.style.display = 'inline-flex';
    docBtn.onclick = async () => {
      const w = window.open('', '_blank');   // open synchronously so popup blockers allow it
      try { w.location = await sbGetDocumentUrl(activeEmployee.document_path); }
      catch (err) { if (w) w.close(); console.error(err); alert('Could not open the document.'); }
    };
  } else { docBtn.style.display = 'none'; }

  $('profEditBtn').onclick = openEditEmployee;

  $('profAttendanceScroll').innerHTML = 'Loading...';
  try {
    [currentTechAttendance, techPayslips] = await Promise.all([sbFetchAttendance(techId), sbFetchPayslips(techId)]);
    
    attViewDate = new Date(); 
    isAttUnlocked = false;
    $('unlockAttBtn').innerHTML = '<i class="fas fa-lock"></i> Unlock Past';
    $('unlockAttBtn').style.background = '#fef3c7';
    $('unlockAttBtn').style.color = '#92400e';
    
    calculateProfileStats();
    renderAttendanceCalendar();
  } catch (err) { console.error(err); }

  $('profileModalBack').classList.add('open');
};

// Event wiring — called once from app.js after the user is signed in.
function initTeam() {

  $('addEmployeeBtn').onclick = () => {
    $('employeeForm').reset();
    $('empId').value = makeId();
    $('empHireDate').value = todayISO();
    let probEnd = new Date(); probEnd.setMonth(probEnd.getMonth() + 3);
    $('empProbationEnd').value = toISODate(probEnd);
    $('terminationFields').classList.add('hidden');
    $('employeeModalTitle').textContent = 'Add New Employee';
    $('employeeModalBack').classList.add('open');
  };

  $('employeeForm').onsubmit = async (e) => {
    e.preventDefault();
    const isEdit = $('employeeModalTitle').textContent === 'Edit Employee';
    const file = $('empDocument').files[0] || null;
    
    const techData = {
      id: $('empId').value,
      name: $('empName').value,
      email: $('empEmail').value,
      phone: $('empPhone').value,
      address: $('empAddress').value,
      department: $('empDept').value,
      employment_status: $('empStatus').value,
      base_monthly_rate: Number($('empRate').value),
      hire_date: $('empHireDate').value || null,                 // '' is not a valid date for the database
      probation_end_date: $('empProbationEnd').value || null,
      nis: $('empNis').value,
      trn: $('empTrn').value,
      license_number: $('empLicense').value,
      notes: $('empNotes').value
    };
    
    if ($('empStatus').value === 'Terminated') {
      techData.termination_reason = $('empTerminationReason').value;
      techData.termination_date = $('empTerminationDate').value || null;
      techData.rehire_eligible = $('empRehire').value === 'true';
    } else if (isEdit) {
      // Status changed away from Terminated: clear the old termination details
      techData.termination_reason = null;
      techData.termination_date = null;
      techData.rehire_eligible = null;
    }

    try {
      await sbSaveTechnician(techData, file, isEdit);
      
      alert(`Employee ${isEdit ? 'updated' : 'added'} successfully!`);
      $('employeeModalBack').classList.remove('open');
      fetchTechnicians();
    } catch (err) { console.error(err); alert('Error saving employee.'); }
  };
}
