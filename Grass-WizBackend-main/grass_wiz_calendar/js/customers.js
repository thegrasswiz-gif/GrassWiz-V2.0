// Customers: the phone number is the primary identifier.
// A customer record holds the CURRENT name / phone / address. Every job and inspection keeps its own
// snapshot of these, so old records never change; changes are logged so old numbers still find the customer.

// Digits-only comparison key. 876-555-1234, 8765551234 and +1 876 555 1234 all give 8765551234.
// An 11-digit number starting with 1 loses the 1; a 7-digit local number is treated as 876.
function phoneKey(p) {
  const d = String(p == null ? '' : p).replace(/\D/g, '');
  if (!d) return '';
  if (d.length === 11 && d[0] === '1') return d.slice(1);
  if (d.length === 7) return '876' + d;
  return d;
}

const norm = s => String(s == null ? '' : s).trim().replace(/\s+/g, ' ').toLowerCase();

function getCustomer(id) { return customers.find(c => c.id === id) || null; }

// Look up by phone: current number first, then numbers a customer used to have.
function findCustomerByPhone(phone) {
  const key = phoneKey(phone);
  if (!key) return null;
  let c = customers.find(c => c.phoneKey === key);
  if (c) return c;
  const old = customerChanges.find(ch => ch.field === 'phone' && phoneKey(ch.oldValue) === key);
  return old ? getCustomer(old.customerId) : null;
}

function customerHistory(id) {
  return customerChanges.filter(ch => ch.customerId === id)
    .sort((a, b) => String(b.changedAt).localeCompare(String(a.changedAt)));
}

// Everything a customer has ever been called / reached at, for search.
function customerSearchText(c) {
  const parts = [c.name, c.phone, c.address, c.email];
  customerHistory(c.id).forEach(ch => parts.push(ch.oldValue, ch.newValue));
  return parts.filter(Boolean).join(' ').toLowerCase();
}
function customerPhoneKeys(c) {
  const keys = new Set();
  if (c.phoneKey) keys.add(c.phoneKey);
  customerHistory(c.id).forEach(ch => { if (ch.field === 'phone') { keys.add(phoneKey(ch.oldValue)); keys.add(phoneKey(ch.newValue)); } });
  keys.delete('');
  return keys;
}

// Does a search term match this customer (name / address / email by text, phone by digits, old values included)?
function customerMatches(c, term) {
  const t = norm(term);
  if (!t) return true;
  if (customerSearchText(c).includes(t)) return true;
  const digits = t.replace(/\D/g, '');
  if (digits.length >= 3) {
    for (const k of customerPhoneKeys(c)) if (k.includes(digits) || ('1' + k).includes(digits)) return true;
    const own = String(c.phone || '').replace(/\D/g, '');
    if (own.includes(digits)) return true;
  }
  return false;
}
function searchCustomers(term, limit = 6) {
  if (!norm(term)) return [];
  return customers.filter(c => customerMatches(c, term)).slice(0, limit);
}

// Does a job/inspection match a search term? Own snapshot, or its customer (current + old identifiers).
function jobMatchesCustomerTerm(j, term) {
  const t = norm(term);
  const digits = t.replace(/\D/g, '');
  if (digits.length >= 3) {
    const k = phoneKey(j.phone), own = String(j.phone || '').replace(/\D/g, '');
    if (own.includes(digits) || k.includes(digits)) return true;
  }
  const c = j.customerId ? getCustomer(j.customerId) : null;
  return !!(c && customerMatches(c, term));
}

function newChange(customerId, field, oldValue, newValue) {
  return { id: 'ch_' + makeId(), customerId, field, oldValue: oldValue || '', newValue: newValue || '',
           changedAt: new Date().toISOString(), changedBy: (window.currentUserEmail || null) };
}

function isMissingCustomerTable(err) {
  return !!err && (err.code === '42P01' || err.code === 'PGRST205' || /customers|customer_changes/i.test(err.message || ''));
}

async function fetchCustomers() {
  try {
    customers = await sbFetchCustomers();
    customerChanges = await sbFetchCustomerChanges();
    customersAvailable = true;
  } catch (e) {
    customers = []; customerChanges = []; customersAvailable = false;
    console.warn('Customers unavailable - run sql/apply-all-updates.sql in Supabase.', e);
  }
}

// Persist a customer (insert or update) and keep the local lists in sync.
async function saveCustomerRecord(c, changes = []) {
  const exists = !!getCustomer(c.id);
  await sbSaveCustomer(c, exists);
  if (changes.length) await sbLogCustomerChanges(changes);
  if (exists) customers = customers.map(x => x.id === c.id ? c : x); else customers.push(c);
  customerChanges = customerChanges.concat(changes);
  if (typeof refreshCustomersTab === 'function') refreshCustomersTab();
}

// Work out which customer a job/inspection belongs to, creating or updating the record as needed.
// d: { name, phone, email, address, directions, zone, yardSize }   linkedId: customer the form was linked to
// ask(message) -> boolean (defaults to window.confirm). Returns the customer id, or null if customers are unavailable.
async function resolveCustomer(d, linkedId = null, ask = (m) => window.confirm(m)) {
  if (!customersAvailable) return null;
  d = { ...d, name: String(d.name || d.customer || '').trim() };      // a job record calls it "customer"
  const key = phoneKey(d.phone);
  const linked = linkedId ? getCustomer(linkedId) : null;
  const byPhone = key ? findCustomerByPhone(d.phone) : null;
  let target = null, phoneChanged = false;

  if (byPhone) {
    target = byPhone;
  } else if (linked && key) {
    const shown = linked.phone || 'no number';
    if (ask(`${linked.name} is saved with ${shown}.\n\nChange their number to ${d.phone} for future jobs?\n\nOK = update the customer (the old number still finds them)\nCancel = this is a different customer`)) {
      target = linked; phoneChanged = true;
    }
  } else if (linked && !key) {
    target = linked;
  } else if (!key) {
    target = customers.find(c => !c.phoneKey && norm(c.name) === norm(d.name)) || null;
  }

  const base = target || { id: 'c_' + makeId(), name: '', phone: '', phoneKey: '', email: '', address: '', directions: '', zone: '', yardSize: '' };
  const next = { ...base };
  const changes = [];

  // identifiers: name, phone, address — only changed when the user agrees, and logged
  const idDiffs = [];
  if (target) {
    if (d.name && norm(d.name) !== norm(base.name)) idDiffs.push(['name', base.name, d.name]);
    if (d.address && norm(d.address) !== norm(base.address)) idDiffs.push(['address', base.address, d.address]);
    if (phoneChanged) idDiffs.push(['phone', base.phone, d.phone]);
    const nameAddr = idDiffs.filter(x => x[0] !== 'phone');
    let accept = true;
    if (nameAddr.length) {
      const lines = nameAddr.map(([f, o, n]) => `• ${f}: "${o || '(blank)'}" → "${n}"`).join('\n');
      accept = ask(`This changes saved details for ${base.name}:\n${lines}\n\nOK = update the customer for future jobs (old jobs keep their old details)\nCancel = use these only on this job`);
    }
    idDiffs.forEach(([f, o, n]) => {
      if (f === 'phone' || accept) { next[f === 'name' ? 'name' : f] = n; changes.push(newChange(base.id, f, o, n)); }
    });
    if (phoneChanged) next.phoneKey = key;
  } else {
    next.name = d.name; next.phone = d.phone || ''; next.phoneKey = key; next.address = d.address || '';
  }
  // everything else just follows the latest booking
  ['email', 'directions', 'zone', 'yardSize'].forEach(f => { if (d[f]) next[f] = d[f]; });

  const unchanged = target && !changes.length && ['email', 'directions', 'zone', 'yardSize'].every(f => next[f] === base[f]);
  if (unchanged) return base.id;
  try {
    await saveCustomerRecord(next, changes);
  } catch (e) {
    if (isMissingCustomerTable(e)) { customersAvailable = false; return null; }
    throw e;
  }
  return next.id;
}

// Jobs/inspections of a customer (own link, or same phone)
function jobsOfCustomer(c) {
  return jobs.filter(j => j.customerId === c.id);
}

window.phoneKey = phoneKey;
