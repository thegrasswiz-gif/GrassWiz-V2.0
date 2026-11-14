// Job modal: create/edit/delete, complete flow, reschedule


window.checkZoneSuggestion = () => {
  let zoneVal = $('zone').value.trim().toLowerCase();
  let suggestionBox = $('zoneSuggestion');
  if(!zoneVal) { suggestionBox.classList.add('hidden'); return; }
  
  let match = jobs.find(j => j.date >= todayISO() && j.status !== 'Cancelled' && j.status !== 'Completed' && j.zone && j.zone.toLowerCase().includes(zoneVal));
  
  if(match) {
      let sizeText = match.yardSize ? match.yardSize + ' yard' : 'job';
      suggestionBox.innerHTML = `💡 You already have a ${sizeText} in ${match.zone} on ${fmtDate(match.date)}. Click to schedule this on the same day.`;
      suggestionBox.classList.remove('hidden');
      suggestionBox.onclick = () => {
          $('jobDate').value = match.date;
          suggestionBox.classList.add('hidden');
      };
  } else {
      suggestionBox.classList.add('hidden');
  }
};

// j with an id = edit that job; j without an id = a pre-filled template for a NEW job (Book Again)
window.openJobModal = (j = null, date = selectedDate, kind = null) => {
  const isEdit = !!(j && j.id);
  editingJobId = isEdit ? j.id : null;
  formKind = kind || (j && j.kind) || 'job';
  formCustomerId = (j && j.customerId) || null;
  setFormKind(formKind, { isEdit, fromTemplate: !!(j && !isEdit) });
  $('deleteJobBtn').classList.toggle('hidden', !isEdit);
  
  $('jobId').value = isEdit ? j.id : '';
  $('customer').value = j ? j.customer : '';
  $('phone').value = j ? j.phone : '';
  $('email').value = j ? j.email : '';
  $('address').value = j ? j.address : '';
  $('directions').value = j ? j.directions : '';
  $('zone').value = j ? j.zone : '';
  $('technician').value = j ? j.technician : '';
  $('yardSize').value = j ? j.yardSize : '';
  $('jobDate').value = j ? j.date : date;
  $('duration').value = j ? j.duration : '1';
  $('customerRemarks').value = j ? j.customerRemarks : '';
  $('recommendations').value = j ? j.recommendations : '';
  $('supervisorRemarks').value = j ? j.supervisorRemarks : '';
  $('reminder').value = j ? j.reminder : '60';
  
  let repeatVal = j ? j.repeat : 'none';
  $('repeat').value = repeatVal;
  $('repeatUntilContainer').classList.toggle('hidden', repeatVal === 'none');
  $('repeatUntil').value = j && j.repeatUntil ? j.repeatUntil : '';

  $('otherService').value = j ? j.otherService : '';
  if($('otherService').value) { $('chkOtherService').checked = true; $('otherService').classList.remove('hidden'); } 
  else { $('chkOtherService').checked = false; $('otherService').classList.add('hidden'); }

  document.querySelectorAll('input[name="propertyAreas"]').forEach(cb => cb.checked = false);
  document.querySelectorAll('input[name="servicesRequired"]').forEach(cb => cb.checked = false);
  document.querySelectorAll('input[name="gardenDetails"]').forEach(cb => cb.checked = false);
  $('gardenOptions').classList.add('hidden');
  
  if (j && j.propertyAreas) {
      let areas = j.propertyAreas.split(', ');
      areas.forEach(val => { 
          let cb = document.querySelector(`input[name="propertyAreas"][value="${val}"]`); 
          if(cb) cb.checked = true; 
          if(val === 'Garden') { $('gardenOptions').classList.remove('hidden'); }
          if(val.startsWith('Garden ')) { 
              let gardenCb = document.querySelector(`input[name="gardenDetails"][value="${val.replace('Garden ','')}"]`); 
              if(gardenCb) gardenCb.checked = true; 
          }
      });
  }
  if (j && j.servicesRequired) j.servicesRequired.split(', ').forEach(val => { let cb = document.querySelector(`input[name="servicesRequired"][value="${val}"]`); if(cb) cb.checked = true; });

  $('zoneSuggestion').classList.add('hidden');
  showCustomerLookup(formCustomerId ? getCustomer(formCustomerId) : null, true);
  $('jobModalBack').classList.add('open');
};

// Switch between "Schedule Job" and "Site Inspection" inside the Add form (fields stay as typed)
window.setFormKind = (kind, opts = {}) => {
  formKind = kind;
  const insp = kind === 'inspection';
  const { isEdit = false, fromTemplate = false } = opts;
  document.querySelectorAll('#kindSwitch button').forEach(b => b.classList.toggle('active', b.dataset.kind === kind));
  $('kindSwitch').classList.toggle('hidden', isEdit);          // an existing record keeps its type
  $('repeatField').classList.toggle('hidden', insp);
  if (insp) { $('repeat').value = 'none'; $('repeatUntilContainer').classList.add('hidden'); }
  $('technicianLabel').textContent = insp ? 'Inspector' : 'Technician';
  $('saveJobBtn').textContent = insp ? 'Save Inspection' : 'Save Job';
  if (opts.isEdit !== undefined && ($('jobModalTitle'))) {
    const noun = insp ? 'Site Inspection' : 'Job';
    $('jobModalTitle').textContent = isEdit ? 'Edit ' + noun : (fromTemplate ? (insp ? 'Book Site Inspection' : 'Book Again') : 'Add New ' + noun);
  }
};

// Phone number banner: shows who the number belongs to
function showCustomerLookup(c, quiet = false) {
  const box = $('customerLookup');
  if (!c) { box.classList.add('hidden'); box.textContent = ''; return; }
  const n = jobs.filter(j => j.customerId === c.id).length;
  box.className = 'lookup';
  box.textContent = `✔ Existing customer: ${c.name}${c.address ? ' — ' + c.address : ''} (${n} previous ${n === 1 ? 'booking' : 'bookings'}).` + (quiet ? '' : ' Details filled in.')
    + ' ' + membershipText(membershipForKey(c.id));
}

function fillFromCustomer(c) {
  $('customer').value = c.name || '';
  $('email').value = c.email || '';
  $('address').value = c.address || '';
  $('directions').value = c.directions || '';
  $('zone').value = c.zone || '';
  if (c.yardSize) $('yardSize').value = c.yardSize;
  formCustomerId = c.id;
  showCustomerLookup(c);
}

// Typing a known phone number (any format, old numbers included) fills in the customer
function onPhoneInput() {
  const key = phoneKey($('phone').value);
  const complete = key.length >= 10;
  const c = complete ? findCustomerByPhone($('phone').value) : null;
  if (c && !editingJobId && (c.id !== formCustomerId || !$('customer').value.trim())) { fillFromCustomer(c); return; }
  if (c && c.id === formCustomerId) { showCustomerLookup(c, true); return; }
  if (!c && complete && !formCustomerId) {
    const box = $('customerLookup'); box.className = 'lookup new'; box.textContent = 'New customer — they will be saved under this number.';
  } else if (!complete && !formCustomerId) { $('customerLookup').classList.add('hidden'); }
}

window.closeJobModal = () => $('jobModalBack').classList.remove('open');

// Book Again: open the Add Job form pre-filled with a past job's customer details.
// Job-specific things (date, technician, remarks, status, repeat) start fresh; the date is left blank to be picked.
window.openBookAgain = (src) => {
  openJobModal({
    ...src, id: null, kind: 'job', date: '', time: '', status: 'Scheduled', technician: '',
    repeat: 'none', repeatUntil: '', recommendations: '', supervisorRemarks: '', closingRemarks: null, reminded: []
  }, '', 'job');
};

// A customer "in the recurring list" has a job still carrying the repeat tag (the series original)
function customerHasRecurring(job) {
  const key = customerKey(job);
  return jobs.some(o => isJob(o) && o.repeat && o.repeat !== 'none' && o.status !== 'Cancelled' && customerKey(o) === key);
}

// The popup after completing a job (or "Make Recurring" on the Completed list).
// Customers already on a repeat schedule get Keep/Cancel Recurring instead of Yes/No,
// so nobody can accidentally start a second overlapping series for them.
function openRecurringPrompt(job) {
  if (!job) return;
  const already = customerHasRecurring(job);
  $('recurringModalTitle').textContent = already ? 'This customer is already recurring' : 'Is this a recurring job?';
  $('recurringModalText').textContent = already
    ? 'Keep the schedule running, or cancel it along with their upcoming visits.'
    : 'If yes, we will automatically schedule the next job.';
  $('recurringNewSection').classList.toggle('hidden', already);
  $('recurringExistingSection').classList.toggle('hidden', !already);
  $('nextRecurringSection').classList.add('hidden');
  $('nextRecurringUntil').value = todayISO();
  $('recurringModalBack').classList.add('open');
}

// Make Recurring on an already-completed job: the same popup used when completing
window.startMakeRecurring = (jobId) => {
  let job = jobs.find(j => j.id === jobId);
  if(!job) return;
  completingJobId = jobId;
  openRecurringPrompt(job);
};

window.confirmPrint = () => {
  $('printPromptModalBack').classList.remove('open');
  if(jobToPrintId) printRecord(jobToPrintId);
};
window.closePrintPrompt = () => {
  $('printPromptModalBack').classList.remove('open');
  jobToPrintId = null;
};

window.startCompleteFlow = (jobId) => {
  completingJobId = jobId;
  $('closingRemarksInput').value = '';
  $('completeModalBack').classList.add('open');
};
window.submitCompleteJob = () => {
  let remarks = $('closingRemarksInput').value.trim();
  if(!remarks) { alert('Please enter closing remarks.'); return; }
  $('completeModalBack').classList.remove('open');
  let job = jobs.find(j => j.id === completingJobId);
  if(job) job.closingRemarks = remarks;
  if (job && job.kind === 'inspection') {          // inspections are never recurring: just mark done
    job.status = 'Completed';
    sbSaveJob(job, true).catch(e => { console.error(e); alert('Error completing the inspection.'); }).finally(() => { completingJobId = null; fetchJobs(); });
    return;
  }
  openRecurringPrompt(job);
};
window.showNextRecurringDate = () => $('nextRecurringSection').classList.remove('hidden');

// choice: true = start a new series, false = complete only (non-recurring customer),
// 'keep' = recurring customer, leave the schedule alone, 'cancel' = end the series
window.finishCompleteFlow = async (choice) => {
  let job = jobs.find(j => j.id === completingJobId);
  if(!job) return;
  if (choice === 'cancel') { await cancelRecurringFlow(job); return; }
  const isRecurring = choice === true;

  // Validate before touching the job, so a missing date doesn't leave it half-completed
  let repeatOption = $('nextRecurringOption').value;
  let endDateStr = $('nextRecurringUntil').value;
  if (isRecurring && !endDateStr) { alert('Please select a repeat until date.'); return; }

  try {
    job.status = 'Completed';
    if (isRecurring) { job.repeat = repeatOption; job.repeatUntil = endDateStr; }   // tag the original so it shows under Recurring Jobs
    await sbSaveJob(job, true);

    if (isRecurring) {
      // only future dates: a job completed late must not spawn copies in the past
      const newJobs = generateRecurringDates(job.date, endDateStr, repeatOption).filter(d => d >= todayISO()).map(newDateStr =>
        ({ ...job, id: makeId(), date: newDateStr, status: 'Scheduled', closingRemarks: null, repeat: 'none', repeatUntil: null, reminded: [] }));
      if (newJobs.length) await sbSaveJobs(newJobs);
    }
  } catch (err) {
    console.error(err);
    alert('Error completing the job. Please try again.');
    fetchJobs();
    return;
  }

  $('recurringModalBack').classList.remove('open');
  completingJobId = null;
  fetchJobs();
};

// Ends a customer's repeat schedule: clears the repeat tag on every job that
// carries it and marks their still-open upcoming visits as Cancelled.
// `job` gets its tag cleared in memory and (when includeSelf) counts toward the
// upcoming visits — its caller picks the final status and saves it.
// Returns false when the user backs out or a save fails.
async function endRecurringSeries(job, includeSelf = false) {
  const key = customerKey(job);
  const upcoming = jobs.filter(o =>
    (includeSelf || o.id !== job.id) && isJob(o) && customerKey(o) === key &&
    o.date >= todayISO() && isOpenJob(o));
  if (upcoming.length && !confirm(
    `This will also cancel ${upcoming.length} upcoming visit${upcoming.length === 1 ? '' : 's'} for ${job.customer}. Continue?`)) return false;

  try {
    job.repeat = 'none';
    job.repeatUntil = '';
    for (const o of jobs) {
      if (o.id === job.id || !isJob(o) || customerKey(o) !== key) continue;
      if (o.repeat && o.repeat !== 'none' && o.status !== 'Cancelled') {
        o.repeat = 'none'; o.repeatUntil = '';
        await sbSaveJob(o, true);
      }
    }
    for (const o of upcoming) {
      if (o.id === job.id) continue;      // caller decides this one's final status
      o.status = 'Cancelled';
      await sbSaveJob(o, true);
    }
  } catch (err) {
    console.error(err);
    alert('Error cancelling the recurring schedule. Please try again.');
    fetchJobs();
    return false;
  }
  return true;
}

// "Cancel Recurring" in the completion popup: this visit completes, the series ends
async function cancelRecurringFlow(job) {
  if (!await endRecurringSeries(job)) return;
  try {
    job.status = 'Completed';
    await sbSaveJob(job, true);
  } catch (err) {
    console.error(err);
    alert('Error completing the job. Please try again.');
    fetchJobs();
    return;
  }

  $('recurringModalBack').classList.remove('open');
  completingJobId = null;
  fetchJobs();
}

// "Cancel Series" on the Recurring Jobs list: ends the schedule. An open visit
// still ahead is cancelled with it; visits already done or past stay as they are
window.cancelJobSeries = async (jobId) => {
  const job = jobs.find(j => j.id === jobId);
  if (!job) return;
  if (!await endRecurringSeries(job, true)) return;
  try {
    if (isOpenJob(job) && job.date >= todayISO()) job.status = 'Cancelled';
    await sbSaveJob(job, true);
  } catch (err) {
    console.error(err);
    alert('Error cancelling the recurring schedule. Please try again.');
  }
  fetchJobs();
};

window.submitReschedule = async () => {
  let job = jobs.find(j => j.id === reschedulingJobId);
  if(!job) return;
  let newDate = $('rescheduleDate').value;
  if(!newDate) return;
  job.date = newDate;
  job.status = 'Scheduled'; 
  await sbSaveJob(job, true);
  $('rescheduleModalBack').classList.remove('open');
  fetchJobs();
};

// Event wiring — called once from app.js after the user is signed in.
function initJobs() {
  $('chkOtherService').onchange = (e) => $('otherService').classList.toggle('hidden', !e.target.checked);
  $('addBtn').onclick = () => openJobModal(null, selectedDate);
  $('addSelectedBtn').onclick = () => openJobModal(null, selectedDate);
  $('cancelJobBtn').onclick = closeJobModal;
  document.querySelectorAll('#kindSwitch button').forEach(b => b.onclick = () => setFormKind(b.dataset.kind, { isEdit: !!editingJobId }));
  $('phone').addEventListener('input', onPhoneInput);

  $('jobForm').onsubmit = async (e) => {
    e.preventDefault();
    
    let jobDateObj = parseDateSafe($('jobDate').value);
    let todayObj = parseDateSafe(todayISO());
    if (jobDateObj < todayObj) {
        if(!confirm(`⚠️ WARNING: You are booking ${formKind === 'inspection' ? 'an inspection' : 'a job'} for a past date. Is this correct?`)) {
            return;
        }
    }

    if (formKind === 'job' && !editingJobId && $('repeat').value !== 'none' && !$('repeatUntil').value) {
        alert('Please choose a "Repeat Until" date for this recurring job.');
        return;
    }

    let areaList = Array.from(document.querySelectorAll('input[name="propertyAreas"]:checked')).map(cb => cb.value);
    let gardenList = Array.from(document.querySelectorAll('input[name="gardenDetails"]:checked')).map(cb => 'Garden ' + cb.value);
    let propertyAreas = areaList.concat(gardenList).join(', ');

    let servicesRequired = Array.from(document.querySelectorAll('input[name="servicesRequired"]:checked')).map(cb => cb.value).join(', ');
    
    const isInsp = formKind === 'inspection';
    let base = {
      id: editingJobId || makeId(),
      kind: formKind,
      customer: $('customer').value.trim(), phone: $('phone').value.trim(), email: $('email').value.trim(),
      address: $('address').value.trim(), directions: $('directions').value.trim(), zone: $('zone').value.trim(),
      technician: $('technician').value, yardSize: $('yardSize').value,
      date: $('jobDate').value, duration: Number($('duration').value),
      status: 'Scheduled',
      propertyAreas: propertyAreas, servicesRequired: servicesRequired, otherService: $('otherService').value.trim(),
      customerRemarks: $('customerRemarks').value.trim(),
      recommendations: $('recommendations').value.trim(),
      supervisorRemarks: $('supervisorRemarks').value.trim(),
      reminder: Number($('reminder').value), repeat: isInsp ? 'none' : $('repeat').value, repeatUntil: isInsp ? '' : $('repeatUntil').value, reminded: []
    };

    try {
      const oldRec = editingJobId ? jobs.find(x => x.id === editingJobId) : null;
      base.customerId = await resolveCustomer(base, formCustomerId || (oldRec && oldRec.customerId) || null)
                        || (oldRec && oldRec.customerId) || null;
      if (editingJobId) {
        let old = oldRec;
        if (old) { base.status = old.status; base.closingRemarks = old.closingRemarks; base.reminded = old.reminded || []; }
        await sbSaveJob(base, true);
        jobToPrintId = base.id;
      } else {
        await sbSaveJob(base, false);
        jobToPrintId = base.id;
        
        if (base.repeat !== 'none' && base.repeatUntil) {
          const copies = generateRecurringDates(base.date, base.repeatUntil, base.repeat).map(newDateStr =>
            ({ ...base, id: makeId(), date: newDateStr, repeat: 'none', repeatUntil: null, reminded: [] }));
          if (copies.length) await sbSaveJobs(copies);
        }
      }
      selectedDate = base.date; viewDate = parseDateSafe(base.date);
      closeJobModal(); 
      fetchJobs();
      
      $('printPromptTitle').textContent = isInsp ? 'Inspection Saved Successfully!' : 'Job Saved Successfully!';
      $('printPromptText').textContent = isInsp ? 'Do you want to print the Inspection Sheet?' : 'Do you want to print the Job Order for this job?';
      $('printPromptModalBack').classList.add('open');
      
    } catch (err) { alert(err && /database upgrade/.test(err.message) ? err.message : 'Error saving. Please try again.'); console.error(err); }
  };

  $('deleteJobBtn').onclick = async () => {
    if (editingJobId && confirm(formKind === 'inspection' ? 'Delete this inspection?' : 'Delete this job?')) {
      try { await sbDeleteJob(editingJobId); closeJobModal(); fetchJobs(); } 
      catch (err) { alert('Error deleting job.'); }
    }
  };
}
