// Calendar grid, sidebar (upcoming / selected day) and job cards


window.fetchJobs = async function() {
  try {
    jobs = await sbFetchJobs();
    showAppError('');
    renderCalendar();
    refreshActionList();
    refreshInspections();
    refreshCustomersTab();
  } catch (err) {
    if (handleAuthError(err)) return;
    console.error("Error fetching jobs:", err);
    showAppError(describeLoadError(err));
    renderCalendar();      // still draw the (empty) calendar so the page is usable
  }
};

// Jobs matching the header search box (all jobs when it is empty)
function visibleJobs() {
  const base = customerFilterId ? jobs.filter(j => customerKey(j) === customerFilterId) : jobs;
  if (!searchTerm) return base;
  return base.filter(j =>
    [j.customer, j.address, j.phone, j.email, j.zone, j.technician, j.date]
      .some(v => v && String(v).toLowerCase().includes(searchTerm))
    || jobMatchesCustomerTerm(j, searchTerm));    // digits-only phone searches, and a customer's old name / number / address
}

function renderCalendar() {
  const shownJobs = visibleJobs();
  const scrollContainer = $('calendarScroll');
  scrollContainer.innerHTML = '';
  for (let i = -6; i <= 5; i++) {
    let monthDate = new Date(viewDate.getFullYear(), viewDate.getMonth() + i, 1);
    let y = monthDate.getFullYear(), m = monthDate.getMonth();
    let block = document.createElement('div');
    block.className = 'month-block';
    if (i === 0) block.classList.add('month-current');
    
    let header = document.createElement('div');
    header.className = 'month-header';
    header.textContent = monthDate.toLocaleDateString(undefined, {month:'long', year:'numeric'});
    block.appendChild(header);
    
    let weekdays = document.createElement('div');
    weekdays.className = 'weekdays';
    weekdays.innerHTML = '<div>Sun</div><div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div>';
    block.appendChild(weekdays);
    
    let daysGrid = document.createElement('div');
    daysGrid.className = 'days';
    const first = new Date(y, m, 1);
    const start = new Date(y, m, 1 - first.getDay());
    for(let j=0; j<42; j++) {
      let d = new Date(start);
      d.setDate(start.getDate() + j);
      
      let ds = toISODate(d);
      
      let dayJobs = shownJobs.filter(job => job.date === ds && job.status !== 'Cancelled').sort((a,b) => (a.time||'').localeCompare(b.time||''));
      
      let isOff = d.getDay() === 0 || isOffSaturday(d);

      let cell = document.createElement('div');
      cell.className = 'day' + (d.getMonth() !== m ? ' outside' : '') + (ds === todayISO() ? ' today' : '') + (ds === selectedDate ? ' selected' : '') + (isOff ? ' off-day' : '');
      cell.dataset.date = ds;
      
      let offBadge = isOff ? '<span class="off-label">OFF</span>' : '';
      cell.innerHTML = `<div class="daynum"><span>${d.getDate()}</span>${dayJobs.length ? `<span class="dotcount">${dayJobs.length}</span>` : offBadge}</div>`;
      
      dayJobs.slice(0,3).forEach(job => {
        let chip = document.createElement('span');
        chip.className = 'jobchip ' + (job.status === 'Pending' ? 'pending' : '') + (job.kind === 'inspection' ? ' inspection' : '');
        chip.textContent = (job.kind === 'inspection' ? '🔍 ' : '') + (job.time ? job.time + ' ' : '') + job.customer;
        cell.appendChild(chip);
      });
      if(dayJobs.length > 3) { let more = document.createElement('div'); more.className = 'muted'; more.style.fontSize = '9px'; more.textContent = `+${dayJobs.length - 3} more`; cell.appendChild(more); }
      
      cell.addEventListener('click', () => {
        selectedDate = ds; viewDate = new Date(ds + 'T12:00:00');
        $('monthTitle').textContent = viewDate.toLocaleDateString(undefined, {month:'long', year:'numeric'});
        document.querySelectorAll('.day').forEach(el => el.classList.remove('selected'));
        cell.classList.add('selected');
        
        sidebarMode = 'selected'; 
        $('tabSelected').classList.add('active'); 
        $('tabUpcoming').classList.remove('active');
        $('jobList').classList.remove('hidden'); 
        $('upcomingList').classList.add('hidden');
        $('addSelectedBtn').classList.remove('hidden');
        updateSidebar();
      });
      daysGrid.appendChild(cell);
    }
    block.appendChild(daysGrid);
    scrollContainer.appendChild(block);
  }
  $('monthTitle').textContent = viewDate.toLocaleDateString(undefined, {month:'long', year:'numeric'});
  const currentMonthEl = scrollContainer.querySelector('.month-current');
  if (currentMonthEl) currentMonthEl.scrollIntoView({ block: 'start' });
  updateSidebar();
}

function updateSidebar() {
  renderCustomerFilter();
  const shownJobs = visibleJobs();
  // The numbers on the stat boxes use the same selectors as the lists they open (js/actions.js)
  const jobsThisMonth = getCompletedInMonth(viewDate.getFullYear(), viewDate.getMonth()).length;
  const upcomingCount = getUpcomingJobs('month', viewDate).length;
  const recurringCount = getRecurringJobs().length;
  const dueCount = getDueJobs().length;

  $('statMonth').textContent = jobsThisMonth;
  // "Completed this month" follows the month shown in the calendar header
  const now = new Date();
  const isThisMonth = viewDate.getFullYear() === now.getFullYear() && viewDate.getMonth() === now.getMonth();
  $('statMonthLabel').textContent = isThisMonth ? 'Jobs Completed This Month'
    : 'Jobs Completed in ' + viewDate.toLocaleDateString(undefined, { month: 'long', year: viewDate.getFullYear() === now.getFullYear() ? undefined : 'numeric' });
  $('statUpcomingLabel').textContent = isThisMonth ? 'Upcoming Jobs This Month'
    : 'Upcoming in ' + viewDate.toLocaleDateString(undefined, { month: 'long', year: viewDate.getFullYear() === now.getFullYear() ? undefined : 'numeric' });
  $('statUpcoming').textContent = upcomingCount;
  $('statRecurring').textContent = recurringCount;
  $('statDue').textContent = dueCount;

  $('selectedTitle').textContent = fmtDate(selectedDate);
  $('selectedSubtitle').textContent = 'Jobs scheduled for this date';
  const list = $('jobList'); list.innerHTML = '';
  let listJobs = shownJobs.filter(j => j.date === selectedDate).sort((a,b) => (a.time||'').localeCompare(b.time||''));
  
  if(!listJobs.length) { 
    list.innerHTML = `<div class="empty"><i class="fas fa-calendar-times" style="font-size:20px; margin-bottom:8px; color:var(--border);"></i><br>${searchTerm ? 'No matching jobs on this date.' : 'No jobs found for this date.'}</div>`; 
  } else {
    listJobs.forEach(j => {
      list.appendChild(createJobCard(j));
    });
  }

  const upcomingList = $('upcomingList'); upcomingList.innerHTML = '';
  // Same window as the stat box: open jobs inside the month the calendar is viewing
  const upStart = toISODate(new Date(viewDate.getFullYear(), viewDate.getMonth(), 1));
  const upEnd = toISODate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0));
  let upcomingJobs = shownJobs.filter(j => j.date >= todayISO() && j.date >= upStart && j.date <= upEnd && j.status !== 'Cancelled' && j.status !== 'Completed')
    .sort((a, b) => { if (a.date !== b.date) return a.date.localeCompare(b.date); return (a.time || '').localeCompare(b.time || ''); });

  if(!upcomingJobs.length) {
    upcomingList.innerHTML = `<div class="empty"><i class="fas fa-check-circle" style="font-size:20px; margin-bottom:8px; color:var(--border);"></i><br>No upcoming jobs found.</div>`;
  } else {
    upcomingJobs.forEach(j => {
      upcomingList.appendChild(createJobCard(j, true));
    });
  }
}

function createJobCard(j, isUpcoming = false) {
  let card = document.createElement('div');
  const insp = j.kind === 'inspection';
  card.className = 'jobcard' + (insp ? ' inspection' : '');
  let dateDisplay = isUpcoming ? fmtDate(j.date) : [j.time, j.zone || 'No Zone'].filter(Boolean).join(' · ');
  
  card.innerHTML = `
    <div class="jobcardtop"><div><h4>${insp ? '<span class="badge-inspection">Inspection</span>' : tierBadgeHTML(membershipForJob(j))}${esc(j.customer)}</h4><span style="font-size:10px; color:var(--text-muted);">${esc(dateDisplay)}</span></div><span class="status ${esc(String(j.status || '').replaceAll(' ','-'))}">${esc(j.status)}</span></div>
    <p><i class="fas fa-map-marker-alt"></i> ${esc(j.address)}</p>
    <p><i class="fas fa-hard-hat"></i> ${insp ? 'Inspector' : 'Tech'}: ${esc(j.technician) || 'Not assigned'}</p>
    <div class="cardbuttons">
      ${j.status !== 'Completed' && j.status !== 'Cancelled' ? `<button class="small success icon-only complete" title="Mark Complete"><i class="fas fa-check"></i></button><button class="small warning reschedule">Reschedule</button>` : ''}
      <button class="small secondary edit">Edit</button>
      ${insp ? '<button class="small primary btn-sched"><i class="fas fa-calendar-plus"></i> Schedule Job</button><button class="small secondary btn-print" title="Print inspection sheet"><i class="fas fa-print"></i></button>' : ''}
      ${j.status !== 'Completed' && j.status !== 'Cancelled' ? `<button class="small danger cancel">Cancel</button>` : ''}
      <button class="small danger icon-only delete" title="Delete Job" style="margin-left:auto;"><i class="fas fa-trash"></i></button>
    </div>`;
    
  card.querySelector('.edit').onclick = () => openJobModal(j);
  
  let schedBtn = card.querySelector('.btn-sched');
  if(schedBtn) schedBtn.onclick = () => openBookAgain(j);          // starts a normal job from the inspection's details
  let prBtn = card.querySelector('.btn-print');
  if(prBtn) prBtn.onclick = () => printRecord(j.id);

  let compBtn = card.querySelector('.complete');
  if(compBtn) compBtn.onclick = () => startCompleteFlow(j.id);
  
  let cancBtn = card.querySelector('.cancel');
  if(cancBtn) cancBtn.onclick = async () => {
    if(confirm(insp ? 'Cancel this inspection?' : 'Cancel this job?')) {
      try {
        await sbSaveJob({ ...j, status: 'Cancelled' }, true);
      } catch (e) { console.error(e); alert('Error cancelling job.'); }
      fetchJobs();
    }
  };
  
  let reschBtn = card.querySelector('.reschedule');
  if(reschBtn) reschBtn.onclick = () => {
      reschedulingJobId = j.id;
      $('rescheduleDate').value = j.date;
      $('rescheduleModalBack').classList.add('open');
  };

  let delBtn = card.querySelector('.delete');
  if(delBtn) delBtn.onclick = async () => {
    let msg = insp ? 'Delete this inspection?' : j.status === 'Completed' ? '⚠️ WARNING: You are deleting a COMPLETED job. This will affect your financial history. Are you sure?' : 'Are you sure you want to permanently delete this job?';
    if(confirm(msg)) {
      try {
        await sbDeleteJob(j.id);
        fetchJobs();
      } catch(e) { alert('Error deleting job'); }
    }
  };

  return card;
}

// Event wiring — called once from app.js after the user is signed in.
function initCalendar() {

  // --- NAV BUTTONS ---
  $('prevBtn').onclick = () => { viewDate = new Date(viewDate.getFullYear(), viewDate.getMonth()-1, 1); renderCalendar(); };
  $('nextBtn').onclick = () => { viewDate = new Date(viewDate.getFullYear(), viewDate.getMonth()+1, 1); renderCalendar(); };
  $('todayBtn').onclick = () => { viewDate = new Date(); selectedDate = todayISO(); renderCalendar(); };

  $('customerFilter').onchange = (e) => {
    customerFilterId = e.target.value;
    const sc = $('calendarScroll'), top = sc.scrollTop;
    renderCalendar();
    sc.scrollTop = top;
  };

  // Header search box: filters the calendar chips and both sidebar lists
  $('searchInput').oninput = (e) => {
    searchTerm = e.target.value.trim().toLowerCase();
    const sc = $('calendarScroll'), top = sc.scrollTop;
    renderCalendar();
    sc.scrollTop = top;            // don't jump back to the current month while typing
  };
}
