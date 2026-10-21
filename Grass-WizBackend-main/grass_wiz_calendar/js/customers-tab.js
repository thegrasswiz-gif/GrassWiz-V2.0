// Customers tab: everyone grouped by membership tier, filtered by the search box.

let customerTabTerm = '';

function renderCustomersTab() {
  const root = $('customerGroups');
  root.innerHTML = '';
  if (!customersAvailable) {
    root.innerHTML = '<div class="empty">Customers need the database upgrade: run <b>sql/apply-all-updates.sql</b> in Supabase.</div>';
    $('custTabSubtitle').textContent = '';
    return;
  }
  const rows = customers
    .filter(c => customerMatches(c, customerTabTerm))
    .map(c => ({ c, m: membershipForCustomer(c) }));
  $('custTabSubtitle').textContent = `${rows.length} customer${rows.length === 1 ? '' : 's'}` + (customerTabTerm ? ` matching "${customerTabTerm}"` : '');

  const groups = MEMBERSHIP_TIERS.concat([NO_TIER]);
  let shown = 0;
  groups.forEach(g => {
    const members = rows.filter(r => (r.m.tier ? r.m.tier.name : NO_TIER.name) === g.name)
      .sort((x, y) => y.m.count - x.m.count || x.c.name.localeCompare(y.c.name));
    if (!members.length) return;
    shown++;
    const sec = document.createElement('section');
    sec.className = 'tier-group';
    sec.dataset.tier = g.name;
    const rule = g === NO_TIER ? 'Under 3 completed jobs · no discount yet' : `${g.grass} · ${g.min}${g === MEMBERSHIP_TIERS[0] ? '+' : '–' + (MEMBERSHIP_TIERS[MEMBERSHIP_TIERS.indexOf(g) - 1].min - 1)} completed jobs · ${g.discount}% off`;
    sec.innerHTML = `<h3 class="tier-head" style="border-color:${g.color}"><span class="badge-tier" style="background:${g.color}"><i class="fas fa-leaf"></i> ${esc(g.name)}</span>
      ${esc(rule)} <span class="tier-count">${members.length}</span></h3><div class="action-grid"></div>`;
    const grid = sec.querySelector('.action-grid');
    members.forEach(({ c, m }) => grid.appendChild(createCustomerCard(c, m, g)));
    root.appendChild(sec);
  });
  if (!shown) root.innerHTML = `<div class="empty"><i class="fas fa-users" style="font-size:22px; margin-bottom:8px; color:var(--border);"></i><br>${customerTabTerm ? 'No customers match your search.' : 'No customers yet. They are added when you book a job.'}</div>`;
}

function createCustomerCard(c, m, g) {
  const card = document.createElement('div');
  card.className = 'jobcard cust-card';
  card.style.borderLeft = `4px solid ${g.color}`;
  card.tabIndex = 0;
  const progress = m.next ? `${m.toNext} more job${m.toNext === 1 ? '' : 's'} to ${m.next.name}` : 'Top tier';
  card.innerHTML = `
    <div class="jobcardtop"><div><h4>${esc(c.name)}</h4><span style="font-size:10px; color:var(--text-muted);">${esc(progress)}</span></div>
      <span class="badge-tier" style="background:${g.color}; margin:0;"><i class="fas fa-leaf"></i> ${esc(g.name)}${g.discount ? ' ' + g.discount + '%' : ''}</span></div>
    <p><i class="fas fa-phone"></i> ${esc(c.phone) || 'No phone'}</p>
    <p><i class="fas fa-map-marker-alt"></i> ${esc(c.address) || 'No address'}</p>
    <p><i class="fas fa-check-circle"></i> ${m.count} completed job${m.count === 1 ? '' : 's'}</p>
    <div class="cardbuttons"><button class="small primary btn-job"><i class="fas fa-calendar-plus"></i> Schedule Job</button></div>`;
  card.onclick = () => openCustomerModal(c.id);
  card.onkeydown = (e) => { if (e.key === 'Enter' && e.target === card) openCustomerModal(c.id); };
  card.querySelector('.btn-job').onclick = (e) => { e.stopPropagation(); openJobModal(customerTemplate(c, 'job'), '', 'job'); };
  return card;
}

function refreshCustomersTab() {
  if ($('viewCustomers').classList.contains('active')) renderCustomersTab();
}

// Event wiring — called once from app.js after the user is signed in.
function initCustomersTab() {
  $('navCustomers').onclick = () => { showView('customers'); fetchJobs().then(renderCustomersTab); };
  $('custTabSearch').oninput = (e) => { customerTabTerm = e.target.value.trim(); renderCustomersTab(); };
}
