// Site inspections: their own tab, the short printable sheet, and the complete flow.
// Inspections are stored in the jobs table with kind = 'inspection', so they also show on the calendar.

const isInspection = j => j.kind === 'inspection';
const INSPECTION_FILTERS = {
  upcoming:  { label: 'Upcoming',  test: j => isOpenJob(j) && j.date >= todayISO() },
  overdue:   { label: 'Past due',  test: j => isOpenJob(j) && j.date < todayISO() },
  completed: { label: 'Completed', test: j => j.status === 'Completed' },
  all:       { label: 'All',       test: j => j.status !== 'Cancelled' }
};
let inspectionFilter = 'upcoming';

function getInspections(filter = inspectionFilter) {
  const test = (INSPECTION_FILTERS[filter] || INSPECTION_FILTERS.all).test;
  const list = jobs.filter(j => isInspection(j) && test(j));
  return filter === 'completed' || filter === 'all'
    ? list.sort((a, b) => b.date.localeCompare(a.date))
    : list.sort((a, b) => a.date.localeCompare(b.date));
}

window.openInspections = () => { showView('inspections'); renderInspections(); };

function refreshInspections() {
  if ($('viewInspections').classList.contains('active')) renderInspections();
}

function renderInspections() {
  document.querySelectorAll('#inspectionFilters button[data-filter]').forEach(b => b.classList.toggle('active', b.dataset.filter === inspectionFilter));
  const counts = {};
  Object.keys(INSPECTION_FILTERS).forEach(k => counts[k] = getInspections(k).length);
  document.querySelectorAll('#inspectionFilters button[data-filter]').forEach(b => { b.querySelector('.cnt').textContent = counts[b.dataset.filter]; });
  const list = getInspections();
  $('inspectionSubtitle').textContent = `${list.length} ${INSPECTION_FILTERS[inspectionFilter].label.toLowerCase()}`;
  const grid = $('inspectionGrid');
  grid.innerHTML = '';
  if (!list.length) {
    grid.innerHTML = `<div class="empty" style="grid-column:1/-1;"><i class="fas fa-clipboard-check" style="font-size:22px; margin-bottom:8px; color:var(--border);"></i><br>No ${esc(INSPECTION_FILTERS[inspectionFilter].label.toLowerCase())} inspections.</div>`;
    return;
  }
  list.forEach(j => grid.appendChild(createJobCard(j, true)));
}

// Short sheet taken to the site: only the key fields, then room to write and sign.
function printInspectionSheet(j) {
  const rows = (pairs) => pairs.map(([l, v]) => `<tr><td class="label">${l}</td><td>${esc(v) || '&nbsp;'}</td></tr>`).join('');
  const areas = ['Front', 'Back', 'Left Side', 'Right Side', 'Sidewalk Left', 'Sidewalk Right', 'Driveway', 'Garden']
    .map(a => `<div><span class="checkbox ${j.propertyAreas && j.propertyAreas.includes(a) ? 'checked' : ''}"></span>${a}</div>`).join('');
  const lines = Array(8).fill('<div class="line"></div>').join('');
  const html = `<html><head><title>Site Inspection</title><style>
    body { font-family: Arial, sans-serif; padding: 24px; color: #000; font-size: 13px; }
    .header { text-align: center; margin-bottom: 18px; } .header h1 { margin: 0; font-size: 22px; text-transform: uppercase; }
    .header p { margin: 4px 0; font-size: 12px; } h2 { font-size: 15px; text-transform: uppercase; margin: 0 0 8px; text-align: center; }
    .section { border: 1px solid #000; padding: 10px; margin-bottom: 14px; }
    .section-title { font-weight: bold; text-transform: uppercase; border-bottom: 1px solid #000; padding-bottom: 4px; margin-bottom: 8px; }
    table { width: 100%; border-collapse: collapse; } td { padding: 5px 4px; border-bottom: 1px solid #ccc; vertical-align: top; }
    .label { font-weight: bold; width: 120px; } .grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }
    .checkbox { display: inline-block; width: 12px; height: 12px; border: 1px solid #000; margin-right: 5px; text-align: center; line-height: 12px; font-size: 10px; }
    .checkbox.checked::after { content: "✔"; } .line { border-bottom: 1px solid #000; height: 26px; }
    .sign { display: flex; gap: 30px; margin-top: 34px; } .sign div { flex: 1; border-top: 1px solid #000; padding-top: 4px; font-size: 11px; }
    @media print { body { padding: 0; } .section { page-break-inside: avoid; } }
  </style></head><body>
    <div class="header"><h1>THE GRASS WIZ</h1><p>Landscaping Services</p><p>38 Cassia Park Road, Kingston 11 | 876-229-8462</p></div>
    <h2>Site Inspection</h2>
    <div class="section"><div class="section-title">Customer &amp; Site</div><table>${rows([
      ['Client Name:', j.customer], ['Phone:', j.phone], ['Address:', j.address], ['Directions:', j.directions], ['Zone / Parish:', j.zone]])}</table></div>
    <div class="section"><div class="section-title">Visit</div><table>${rows([
      ['Date:', fmtDate(j.date)], ['Inspector:', j.technician], ['Yard Size:', j.yardSize]])}</table></div>
    <div class="section"><div class="section-title">Areas to Inspect</div><div class="grid-4">${areas}</div></div>
    <div class="section"><div class="section-title">Notes</div>${lines}</div>
    <div class="sign"><div>Inspector signature</div><div>Client signature</div><div>Date</div></div>
    <script>window.onload = function() { window.print(); }<\/script></body></html>`;
  openPrintWindow(html);
}

// The right printout for a job or an inspection
function printRecord(id) {
  const j = jobs.find(x => x.id === id);
  if (!j) return;
  if (isInspection(j)) printInspectionSheet(j); else printJobOrder(id);
}

// Event wiring — called once from app.js after the user is signed in.
function initInspections() {
  $('navInspections').onclick = () => { showView('inspections'); fetchJobs().then(renderInspections); };
  $('inspBackBtn').onclick = () => showView('calendar');
  $('inspAddBtn').onclick = () => openJobModal(null, todayISO(), 'inspection');
  document.querySelectorAll('#inspectionFilters button[data-filter]').forEach(b => b.onclick = () => { inspectionFilter = b.dataset.filter; renderInspections(); });
}
