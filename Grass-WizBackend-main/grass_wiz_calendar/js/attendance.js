// Employee attendance calendar and profile stats


function calculateProfileStats() {
  const HOURLY_RATE = Number(activeEmployee.base_monthly_rate) / 188.4;
  const WEEKDAY_PAY = 8 * HOURLY_RATE; 
  const SATURDAY_PAY = 5 * HOURLY_RATE * 1.5;

  let hireDate = parseDateSafe(activeEmployee.hire_date);
  let daysWorked = 0;
  let presentCount = 0;
  let absentCount = 0;
  
  currentTechAttendance.forEach(rec => {
    let recDate = parseDateSafe(rec.date);
    
    if(rec.status.startsWith('Present')) {
      presentCount++;
      if(recDate >= hireDate) {
        let dayOfWeek = recDate.getDay();
        if(dayOfWeek >= 1 && dayOfWeek <= 5) daysWorked++;
      }
    }
    if(rec.status.startsWith('Absent')) {
      absentCount++;
    }
  });

  $('legendPresent').textContent = presentCount;
  $('legendAbsent').textContent = absentCount;
  $('profDaysWorkedCounter').textContent = `${daysWorked} / 110`;
  $('profDailyRate').textContent = `$${WEEKDAY_PAY.toLocaleString(undefined, {minimumFractionDigits:2})}`;

  let period = getCurrentPayPeriod();
  let accumulatedPay = 0;
  
  currentTechAttendance.forEach(rec => {
    let recDate = parseDateSafe(rec.date);
    if(rec.status.startsWith('Present') && recDate >= period.start && recDate <= period.end) {
      let dayOfWeek = recDate.getDay();
      if (dayOfWeek >= 1 && dayOfWeek <= 5) accumulatedPay += WEEKDAY_PAY;
      else if (dayOfWeek === 6) {
        if (!isOffSaturday(recDate)) accumulatedPay += SATURDAY_PAY;
      }
    }
  });

  $('profAccumulatedPay').textContent = `$${accumulatedPay.toLocaleString(undefined, {minimumFractionDigits:2})}`;
}

window.changeAttMonth = (offset) => {
  // build from the 1st: setMonth() on the 29th-31st skips or repeats months
  attViewDate = new Date(attViewDate.getFullYear(), attViewDate.getMonth() + offset, 1);
  renderAttendanceCalendar();
};

window.unlockAttendance = () => {
  if (isAttUnlocked) return;
  let pwd = prompt("Enter Admin Password to unlock past attendance:");
  if (pwd === "grasswiz") {
      isAttUnlocked = true;
      $('unlockAttBtn').innerHTML = '<i class="fas fa-unlock"></i> Unlocked';
      $('unlockAttBtn').style.background = '#d1fae5';
      $('unlockAttBtn').style.color = '#065f46';
      renderAttendanceCalendar();
  } else if (pwd !== null) {
      alert("Incorrect password.");
  }
};

function renderAttendanceCalendar() {
  const container = $('profAttendanceScroll');
  container.innerHTML = '';
  
  let y = attViewDate.getFullYear();
  let m = attViewDate.getMonth();
  
  $('attMonthTitle').textContent = attViewDate.toLocaleDateString(undefined, {month:'long', year:'numeric'});
  
  let block = document.createElement('div');
  block.className = 'month-block';
  
  let weekdays = document.createElement('div');
  weekdays.className = 'weekdays';
  weekdays.innerHTML = '<div>Sun</div><div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div>';
  block.appendChild(weekdays);
  
  let grid = document.createElement('div');
  grid.className = 'days';
  
  let daysInMonth = new Date(y, m + 1, 0).getDate();
  let firstDay = new Date(y, m, 1).getDay();
  let hireDateObj = parseDateSafe(activeEmployee.hire_date);
  
  let today = new Date();
  today.setHours(0,0,0,0);
  
  let oneWeekAgo = new Date(today);
  oneWeekAgo.setDate(today.getDate() - 7);
  
  for (let empty = 0; empty < firstDay; empty++) {
      let emptyDiv = document.createElement('div');
      emptyDiv.className = 'day outside';
      grid.appendChild(emptyDiv);
  }
  
  for (let day = 1; day <= daysInMonth; day++) {
    let dateObj = new Date(y, m, day, 0, 0, 0, 0);
    let dateStr = y + '-' + String(m+1).padStart(2,'0') + '-' + String(day).padStart(2,'0');
    let dayOfWeek = dateObj.getDay();
    
    let isOff = dayOfWeek === 0 || isOffSaturday(dateObj);
    
    let isBeforeHire = dateObj < hireDateObj;
    let isFuture = dateObj > today;
    let isTooOld = dateObj < oneWeekAgo && !isAttUnlocked;
    
    let isLocked = isBeforeHire || isFuture || isTooOld;
    
    let record = currentTechAttendance.find(a => a.date.split('T')[0] === dateStr);
    let status = record ? record.status : (isOff ? 'Off' : 'Unmarked');
    
    let cell = document.createElement('div');
    cell.className = 'day' + (isOff ? ' off-day' : '') + (status.startsWith('Present') ? ' present-day' : '') + (status.startsWith('Absent') ? ' absent-day' : '');
    
    let offBadge = isOff ? '<span class="off-label">OFF</span>' : '';
    let statusBadge = '';
    if (status === 'Present') statusBadge = '<span style="color:#10b981; font-weight:800; font-size:9px;">P</span>';
    if (status === 'Absent (Unpaid)') statusBadge = '<span style="color:#ef4444; font-weight:800; font-size:9px;">A (U)</span>';
    if (status === 'Absent (Paid)') statusBadge = '<span style="color:#f59e0b; font-weight:800; font-size:9px;">A (P)</span>';

    if (isLocked) {
      cell.classList.add('locked-day');
      cell.innerHTML = `<div class="daynum"><span>${day}</span><span>🔒</span></div>`;
    } else {
      cell.innerHTML = `<div class="daynum"><span>${day}</span>${offBadge}${statusBadge}</div>`;
      if (!isOff) {
          cell.onclick = () => {
              selectedAttDate = dateStr;
              selectedAttRecordId = record ? record.id : null;
              $('attActionDate').textContent = fmtDate(dateStr);
              $('attStep1').classList.remove('hidden');
              $('attStep2').classList.add('hidden');
              $('attActionModalBack').classList.add('open');
          };
      }
    }
    grid.appendChild(cell);
  }
  block.appendChild(grid);
  container.appendChild(block);
}

window.showAbsentOptions = () => {
  $('attStep1').classList.add('hidden');
  $('attStep2').classList.remove('hidden');
};

window.setAttendance = async (type) => {
  let finalStatus = type;
  if (type === 'Absent') {
    finalStatus = 'Absent (' + $('attLeaveType').value + ')';
  }
  
  let existingRecord = currentTechAttendance.find(a => a.date.split('T')[0] === selectedAttDate);
  const previousStatus = existingRecord ? existingRecord.status : null;
  const recordId = (existingRecord && existingRecord.id) || selectedAttRecordId || makeId();
  if(existingRecord) {
      existingRecord.status = finalStatus;
  } else {
      existingRecord = { id: recordId, tech_id: activeEmployee.id, date: selectedAttDate, status: finalStatus };
      currentTechAttendance.push(existingRecord);
  }

  calculateProfileStats();
  renderAttendanceCalendar(); 

  $('attActionModalBack').classList.remove('open');

  try {
    await sbSaveAttendance({ id: recordId, tech_id: activeEmployee.id, date: selectedAttDate, status: finalStatus });
  } catch (err) {
    // The save failed: undo the on-screen change so payroll isn't based on attendance that was never stored
    console.error('Error saving attendance', err);
    if (previousStatus === null) currentTechAttendance = currentTechAttendance.filter(a => a !== existingRecord);
    else existingRecord.status = previousStatus;
    calculateProfileStats();
    renderAttendanceCalendar();
    alert('Could not save attendance. Please check your connection and try again.');
  }
};
