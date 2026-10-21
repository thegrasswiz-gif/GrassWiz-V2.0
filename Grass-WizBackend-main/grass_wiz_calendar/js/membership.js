// Customer membership tiers: the more jobs a customer has completed, the bigger their discount.
// To change the tiers or percentages, edit this list only (highest tier first). "min" = completed jobs needed.
// Inspections never count. Select at 3 jobs, Prestige at 6, Royal Reserve at 12 or more.
const MEMBERSHIP_TIERS = [
  { name: 'Royal Reserve', grass: 'St. Augustine', min: 12, discount: 20, color: '#b7791f' },
  { name: 'Prestige',      grass: 'Zoysia',        min: 6,  discount: 10, color: '#4b5563' },
  { name: 'Select',        grass: 'Bermuda',       min: 3,  discount: 5,  color: '#b45309' }
];
// Customers who haven't reached Select yet (not a membership tier)
const NO_TIER = { name: 'Seedling', grass: 'Seedling', min: 0, discount: 0, color: '#65a30d' };

function completedJobCountForKey(key) {
  return jobs.filter(j => isJob(j) && j.status === 'Completed' && customerKey(j) === key).length;
}

// { count, tier (or null), next (next tier or null), toNext (jobs still needed) }
function membershipForKey(key) {
  const count = key ? completedJobCountForKey(key) : 0;
  const tier = MEMBERSHIP_TIERS.find(t => count >= t.min) || null;
  const next = [...MEMBERSHIP_TIERS].reverse().find(t => t.min > count) || null;
  return { count, tier, next, toNext: next ? next.min - count : 0 };
}
const membershipForJob = j => membershipForKey(customerKey(j));
const membershipForCustomer = c => membershipForKey(c.id);

function membershipText(m) {
  if (!m.tier) return m.next ? `Not a member yet (${m.count} completed, ${m.toNext} more for ${m.next.name}, ${m.next.discount}% off)` : 'No membership yet';
  const nxt = m.next ? ` · ${m.toNext} more for ${m.next.name}` : ' · top tier';
  return `${m.tier.name} member (${m.tier.grass}) — ${m.tier.discount}% discount (${m.count} completed jobs${nxt})`;
}

function tierBadgeHTML(m) {
  return m.tier ? `<span class="badge-tier" style="background:${m.tier.color}"><i class="fas fa-leaf"></i> ${esc(m.tier.name)} ${m.tier.discount}%</span>` : '';
}
