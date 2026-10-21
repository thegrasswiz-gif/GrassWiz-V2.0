// Action list view: click a stat box on the calendar to see (and act on) the jobs behind the number.

// ---- Which jobs each stat box counts. The numbers on the boxes and the lists both use these. ----
const isOpenJob = j => j.status !== 'Cancelled' && j.status !== 'Completed';
const customerKey = j => j.customerId || String(j.customer || '').trim().toLowerCase();
const isJob = j => (j.kind || 'job') === 'job';       // site inspections have their own tab

// Completed jobs dated within a given month, newest first
function getCompletedInMonth(year, month) {
  return jobs
    .filter(j => isJob(j) && j.status === 'Completed' && parseDateSafe(j.date).getFullYear() === year && parseDateSafe(j.date).getMonth() === month)
    .sort((a, b) => b.date.localeCompare(a.date));
}

// Jobs from today onward that are still to be done
function getUpcomingJobs() {
  return jobs
    .filter(j => isJob(j) && j.date >= todayISO() && isOpenJob(j))
    .sort((a, b) => a.date !== b.date ? a.date.localeCompare(b.date) : (a.time || '').localeCompare(b.time || ''));
}

// Jobs that carry a repeat schedule (the original of each series)
function getRecurringJobs() {
  return jobs
    .filter(j => isJob(j) && j.repeat && j.repeat !== 'none' && j.status !== 'Cancelled')
    .sort((a, b) => a.date.localeCompare(b.date));
}

// One job per customer: their most recent completed (non-recurring) job, when they have nothing
// booked and that job was 20+ days ago. Most overdue first.
function getDueJobs() {
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 20);
  const cutoffStr = toISODate(cutoff);
  const hasUpcoming = new Set(jobs.filter(j => j.date >= todayISO() && isOpenJob(j)).map(customerKey));
  const latest = {};
  jobs.forEach(j => {
    if (!isJob(j) || j.status !== 'Completed' || (j.repeat && j.repeat !== 'none')) return;
    const k = customerKey(j);
    if (hasUpcoming.has(k)) return;
    if (!latest[k] || j.date > latest[k].date) latest[k] = j;
  });
  return Object.values(latest).filter(j => j.date <= cutoffStr).sort((a, b) => a.date.localeCompare(b.date));
}

// Job count per customer for the calendar's customer filter: jobs only (no inspections), cancelled ones excluded
function getCustomerJobCounts() {
  const map = new Map();
  jobs.forEach(j => {
    if (!isJob(j) || j.status === 'Cancelled') return;
    const k = customerKey(j);
    if (!k) return;
    const e = map.get(k) || { key: k, name: j.customer, count: 0 };
    e.count++; e.name = j.customer; map.set(k, e);
  });
  return [...map.values()].sort((x, y) => y.count - x.count || x.name.localeCompare(y.name));
}

function renderCustomerFilter() {
  const sel = $('customerFilter');
  const list = getCustomerJobCounts();
  sel.innerHTML = '';
  sel.add(new Option('All customers', ''));
  list.forEach(c => {
    const t = membershipForKey(c.key).tier;
    sel.add(new Option(`${c.name} (${c.count} ${c.count === 1 ? 'job' : 'jobs'})${t ? ' · ' + t.name : ''}`, c.key));
  });
  if (customerFilterId && !list.some(c => c.key === customerFilterId)) customerFilterId = '';
  sel.value = customerFilterId;
}

// ---- The view ----
let actionMode = null;      // 'completed' | 'upcoming' | 'recurring' | 'due'
let actionMonth = null;     // first day of the month shown by the Completed list

const REPEAT_LABELS = {
  weekly: 'Every week', biweekly: 'Every 2 weeks', monthly: 'Monthly (same date)',
  last_thursday: 'Monthly (last Thursday)', last_friday: 'Monthly (last Friday)'
};

function daysSince(dateStr) {
  return Math.round((parseDateSafe(todayISO()) - parseDateSafe(dateStr)) / 86400000);
}

window.openActionList = (mode) => {
  actionMode = mode;
  if (mode === 'completed') actionMonth = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
  showView('actions');
  renderActionList();
};

// Called after every data reload so an open list stays current (e.g. a customer disappears once booked)
function refreshActionList() {
  if (actionMode && $('viewActionList').classList.contains('active')) renderActionList();
}

function renderActionList() {
  const grid = $('actionGrid');
  grid.innerHTML = '';
  $('actionMonthNav').classList.toggle('hidden', actionMode !== 'completed');

  let list = [], title = '', subtitle = '', empty = '';
  if (actionMode === 'completed') {
    const monthName = actionMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    $('actionMonthTitle').textContent = monthName;
    list = getCompletedInMonth(actionMonth.getFullYear(), actionMonth.getMonth());
    title = 'Jobs Completed';
    subtitle = `${list.length} completed in ${monthName}`;
    empty = `No completed jobs in ${monthName}.`;
  } else if (actionMode === 'upcoming') {
    list = getUpcomingJobs();
    title = 'Upcoming Jobs';
    subtitle = `${list.length} still to do, from today onward`;
    empty = 'No upcoming jobs.';
  } else if (actionMode === 'recurring') {
    list = getRecurringJobs();
    title = 'Recurring Jobs';
    subtitle = `${list.length} with a repeat schedule`;
    empty = 'No jobs have a repeat schedule.';
  } else if (actionMode === 'due') {
    list = getDueJobs();
    title = 'Due for Next Service';
    subtitle = `${list.length} customer${list.length === 1 ? '' : 's'} with nothing booked, last serviced 20+ days ago`;
    empty = 'Nobody is due right now.';
  }
  $('actionTitle').textContent = title;
  $('actionSubtitle').textContent = subtitle;

  if (!list.length) {
    grid.innerHTML = `<div class="empty" style="grid-column:1/-1;"><i class="fas fa-check-circle" style="font-size:22px; margin-bottom:8px; color:var(--border);"></i><br>${esc(empty)}</div>`;
    return;
  }
  list.forEach(j => grid.appendChild(
    (actionMode === 'completed' || actionMode === 'due') ? createCompletedCard(j, actionMode) : createScheduledCard(j, actionMode)
  ));
}

// Completed job: Book Again / Make Recurring / Print
function createCompletedCard(j, mode) {
  const card = document.createElement('div');
  card.className = 'jobcard';
  const when = mode === 'due' ? `Last service ${fmtDate(j.date)} · ${daysSince(j.date)} days ago` : fmtDate(j.date);
  card.innerHTML = `
    <div class="jobcardtop"><div><h4>${esc(j.customer)}</h4><span style="font-size:10px; color:var(--text-muted);">${esc(when)}</span></div><span class="status Completed">Completed</span></div>
    <p><i class="fas fa-map-marker-alt"></i> ${esc(j.address)}</p>
    <p><i class="fas fa-phone"></i> ${esc(j.phone) || 'No phone'}</p>
    <p><i class="fas fa-hard-hat"></i> Tech: ${esc(j.technician) || 'Not assigned'}</p>
    ${j.servicesRequired ? `<p><i class="fas fa-leaf"></i> ${esc(j.servicesRequired)}</p>` : ''}
    ${j.closingRemarks ? `<p><i class="fas fa-comment-dots"></i> ${esc(j.closingRemarks)}</p>` : ''}
    <div class="cardbuttons">
      <button class="small primary btn-again"><i class="fas fa-rotate-right"></i> Book Again</button>
      ${mode === 'completed' ? '<button class="small warning btn-recur"><i class="fas fa-sync-alt"></i> Make Recurring</button>' : ''}
      <button class="small secondary btn-print"><i class="fas fa-print"></i> Print</button>
    </div>`;
  card.querySelector('.btn-again').onclick = () => openBookAgain(j);
  const recur = card.querySelector('.btn-recur');
  if (recur) recur.onclick = () => startMakeRecurring(j.id);
  card.querySelector('.btn-print').onclick = () => printJobOrder(j.id);
  return card;
}

// Scheduled job: the normal card (Edit / Reschedule / Complete / Cancel / Delete), plus the repeat pattern
function createScheduledCard(j, mode) {
  const card = createJobCard(j, true);
  if (mode === 'recurring') {
    const info = document.createElement('p');
    info.innerHTML = `<i class="fas fa-sync-alt"></i> ${esc(REPEAT_LABELS[j.repeat] || j.repeat)}${j.repeatUntil ? ' until ' + esc(fmtDate(j.repeatUntil)) : ''}`;
    card.insertBefore(info, card.querySelector('.cardbuttons'));
  }
  return card;
}

// Event wiring — called once from app.js after the user is signed in.
function initActions() {
  document.querySelectorAll('.stat[data-stat]').forEach(box => {
    const open = () => openActionList(box.dataset.stat);
    box.addEventListener('click', open);
    box.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
  });
  $('actionBackBtn').onclick = () => showView('calendar');

  const shiftMonth = (n) => { actionMonth = new Date(actionMonth.getFullYear(), actionMonth.getMonth() + n, 1); renderActionList(); };
  $('actionPrevMonth').onclick = () => shiftMonth(-1);
  $('actionNextMonth').onclick = () => shiftMonth(1);

  // "Jump to Month": the browser's own month picker
  const picker = $('actionMonthPicker');
  $('actionJumpBtn').onclick = () => {
    picker.value = `${actionMonth.getFullYear()}-${String(actionMonth.getMonth() + 1).padStart(2, '0')}`;
    try { picker.showPicker(); } catch (e) { picker.classList.add('visible'); picker.focus(); }
  };
  picker.onchange = () => {
    const m = /^(\d{4})-(\d{2})$/.exec(picker.value);
    picker.classList.remove('visible');
    if (!m) return;
    actionMonth = new Date(Number(m[1]), Number(m[2]) - 1, 1);
    renderActionList();
  };
}
