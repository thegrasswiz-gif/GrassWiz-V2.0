// Customer search dropdown and the customer details window.

let suggestIndex = -1;

function hideSuggest() { $('searchSuggest').classList.add('hidden'); suggestIndex = -1; }

function renderSuggest() {
  const box = $('searchSuggest');
  const term = $('searchInput').value.trim();
  const found = term.length >= 2 ? searchCustomers(term, 6) : [];
  if (!found.length) { hideSuggest(); return; }
  box.innerHTML = '';
  found.forEach(c => {
    const row = document.createElement('div');
    row.className = 'sugg'; row.tabIndex = 0; row.dataset.id = c.id;
    const oldHit = !`${c.name} ${c.phone} ${c.address}`.toLowerCase().includes(term.toLowerCase()) && !String(c.phone).replace(/\D/g, '').includes(term.replace(/\D/g, '') || '\u0000');
    row.innerHTML = `<strong>${esc(c.name)}</strong> · ${esc(c.phone) || 'no phone'}<small>${esc(c.address) || ''}${oldHit ? ' · matched an earlier name / number / address' : ''}</small>`;
    row.onclick = () => { hideSuggest(); openCustomerModal(c.id); };
    row.onkeydown = (e) => { if (e.key === 'Enter') row.click(); };
    box.appendChild(row);
  });
  box.classList.remove('hidden');
}

window.openCustomerModal = (id) => {
  const c = getCustomer(id);
  if (!c) return;
  $('custId').value = c.id;
  $('custPhone').value = c.phone; $('custName').value = c.name; $('custEmail').value = c.email;
  $('custAddress').value = c.address; $('custDirections').value = c.directions; $('custZone').value = c.zone;
  const mine = jobsOfCustomer(c);
  const nJobs = mine.filter(j => (j.kind || 'job') === 'job').length, nInsp = mine.length - nJobs;
  $('custMembership').textContent = membershipText(membershipForCustomer(c));
  $('custSummary').textContent = `${nJobs} job${nJobs === 1 ? '' : 's'} and ${nInsp} inspection${nInsp === 1 ? '' : 's'} on record. Changes here apply to new bookings; old jobs keep the details they were booked with.`;
  const hist = $('custHistory'); hist.innerHTML = '';
  customerHistory(c.id).forEach(ch => {
    const li = document.createElement('li');
    li.textContent = `${new Date(ch.changedAt).toLocaleDateString()} · ${ch.field}: ${ch.oldValue || '(blank)'} → ${ch.newValue || '(blank)'}`;
    hist.appendChild(li);
  });
  $('customerModalBack').classList.add('open');
};

function customerTemplate(c, kind) {
  return { id: null, kind, customerId: c.id, customer: c.name, phone: c.phone, email: c.email, address: c.address,
           directions: c.directions, zone: c.zone, yardSize: c.yardSize, technician: '', date: '', duration: 1,
           repeat: 'none', repeatUntil: '', reminder: 60 };
}

async function saveCustomerForm() {
  const c = getCustomer($('custId').value);
  if (!c) return;
  const next = { ...c, name: $('custName').value.trim(), phone: $('custPhone').value.trim(), email: $('custEmail').value.trim(),
                 address: $('custAddress').value.trim(), directions: $('custDirections').value.trim(), zone: $('custZone').value.trim() };
  next.phoneKey = phoneKey(next.phone);
  if (!next.name || !next.phoneKey) { alert('Name and phone number are required.'); return; }
  const clash = customers.find(x => x.id !== c.id && x.phoneKey === next.phoneKey);
  if (clash) { alert(`${clash.name} already uses that phone number.`); return; }
  const changes = [];
  if (norm(next.name) !== norm(c.name)) changes.push(newChange(c.id, 'name', c.name, next.name));
  if (next.phoneKey !== c.phoneKey) changes.push(newChange(c.id, 'phone', c.phone, next.phone));
  if (norm(next.address) !== norm(c.address)) changes.push(newChange(c.id, 'address', c.address, next.address));
  try {
    await saveCustomerRecord(next, changes);
    $('customerModalBack').classList.remove('open');
  } catch (e) { console.error(e); alert('Error saving customer.'); }
}

// Event wiring — called once from app.js after the user is signed in.
function initCustomerUI() {
  const input = $('searchInput');
  input.addEventListener('input', renderSuggest);
  input.addEventListener('focus', renderSuggest);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') hideSuggest();
    if (e.key === 'ArrowDown') { const first = $('searchSuggest').querySelector('.sugg'); if (first) { e.preventDefault(); first.focus(); } }
  });
  document.addEventListener('click', (e) => { if (!$('searchContainer').contains(e.target)) hideSuggest(); });

  $('customerForm').onsubmit = (e) => { e.preventDefault(); saveCustomerForm(); };
  $('custClose').onclick = () => $('customerModalBack').classList.remove('open');
  const book = (kind) => {
    const c = getCustomer($('custId').value);
    if (!c) return;
    $('customerModalBack').classList.remove('open');
    openJobModal(customerTemplate(c, kind), '', kind);
  };
  $('custBookJob').onclick = () => book('job');
  $('custBookInsp').onclick = () => book('inspection');
}
