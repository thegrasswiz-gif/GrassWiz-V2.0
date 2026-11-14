// Shared helpers
const $ = id => document.getElementById(id);

// Local-time YYYY-MM-DD (toISOString() is UTC, which is already "tomorrow" after 7pm in Jamaica)
function toISODate(d) {
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
const todayISO = () => toISODate(new Date());

// Escape text before putting it into innerHTML / document.write
function esc(v) {
    return String(v == null ? '' : v)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Jamaica's parishes — the Zone/Parish dropdowns
const PARISHES = ['Clarendon','Hanover','Kingston','Manchester','Portland','Saint Andrew','Saint Ann','Saint Catherine','Saint Elizabeth','Saint James','Saint Mary','Saint Thomas','Trelawny','Westmoreland'];

// Fill a Zone/Parish <select> with a prompt option plus the parish list
function fillParishSelect(sel, prompt) {
    sel.innerHTML = '';
    sel.add(new Option(prompt, ''));
    PARISHES.forEach(p => sel.add(new Option(p, p)));
}

// Set a parish select's value. Older records may hold a zone that isn't a
// parish (typed before the dropdown existed); keep it selectable so opening
// the record doesn't silently change it to the first parish
function setParishValue(sel, val) {
    val = val || '';
    sel.querySelectorAll('option[data-legacy]').forEach(o => o.remove());
    if (val && ![...sel.options].some(o => o.value === val)) {
        const opt = new Option(val, val);
        opt.dataset.legacy = '1';
        sel.add(opt);
    }
    sel.value = val;
}

function initParishSelects() {
    fillParishSelect($('zone'), 'Select a parish…');
    fillParishSelect($('custZone'), 'No parish');
}

// Every second Saturday is a day off (alternating, anchored on 10 Oct 2026)
function isOffSaturday(d) {
    if (d.getDay() !== 6) return false;
    const weeksDiff = Math.round((d - new Date('2026-10-10T12:00:00')) / (7 * 24 * 60 * 60 * 1000));
    return weeksDiff % 2 === 0;
}

// Open a print/preview window; tells the user if the browser blocked the pop-up
function openPrintWindow(html) {
    const w = window.open('', '_blank');
    if (!w) { alert('Your browser blocked the pop-up. Allow pop-ups for this site and try again.'); return null; }
    w.document.write(html);
    w.document.close();
    return w;
}

// Dates (YYYY-MM-DD) after startStr, up to and including endStr, for a repeat option.
function generateRecurringDates(startStr, endStr, option) {
    const start = parseDateSafe(startStr), end = parseDateSafe(endStr);
    const out = [], MAX = 500;
    if (!(end > start)) return out;
    if (option === 'weekly' || option === 'biweekly') {
        const step = option === 'weekly' ? 7 : 14;
        for (let n = 1; out.length < MAX; n++) {
            const d = new Date(start); d.setDate(start.getDate() + n * step);
            if (d > end) break;
            out.push(toISODate(d));
        }
    } else if (option === 'monthly') {            // same day each month; 31st -> last day of shorter months
        for (let n = 1; out.length < MAX; n++) {
            const lastDay = new Date(start.getFullYear(), start.getMonth() + n + 1, 0).getDate();
            const d = new Date(start.getFullYear(), start.getMonth() + n, Math.min(start.getDate(), lastDay), 12);
            if (d > end) break;
            out.push(toISODate(d));
        }
    } else if (option === 'last_thursday' || option === 'last_friday') {
        const target = option === 'last_thursday' ? 4 : 5;
        for (let n = 0; n < MAX; n++) {
            const d = new Date(start.getFullYear(), start.getMonth() + n + 1, 0, 12);   // last day of month
            while (d.getDay() !== target) d.setDate(d.getDate() - 1);
            if (d <= start) continue;
            if (d > end) break;
            out.push(toISODate(d));
        }
    }
    return out;
}

// Friendly message for a failed data load, shown in a banner at the top of the page
function describeLoadError(err) {
    const code = err && err.code, msg = String((err && err.message) || '');
    if (code === '42501' || /permission denied/i.test(msg))
        return 'The database refused access (permission denied). Run sql/apply-all-updates.sql in the Supabase SQL Editor, then reload this page.';
    if (/failed to fetch|network/i.test(msg)) return 'Cannot reach the database. Check your internet connection and reload.';
    return 'Could not load data: ' + (msg || 'unknown error');
}
function showAppError(text) {
    const el = $('appError');
    if (!el) return;
    el.textContent = text;
    el.classList.toggle('hidden', !text);
}

function makeId() { return Date.now().toString(36) + Math.random().toString(36).slice(2,7); }

function parseDateSafe(dateStr) {
    if(!dateStr) return new Date();
    if(dateStr instanceof Date) return new Date(dateStr.getFullYear(), dateStr.getMonth(), dateStr.getDate(), 12, 0, 0);
    let cleanStr = String(dateStr).split('T')[0]; 
    let parts = cleanStr.split('-');
    if(parts.length !== 3) return new Date(); 
    return new Date(parts[0], parts[1]-1, parts[2], 12, 0, 0); 
}

function fmtDate(s, opts={weekday:'short',month:'short',day:'numeric',year:'numeric'}) { 
    if(!s) return 'N/A'; 
    let d = parseDateSafe(s);
    if(isNaN(d.getTime())) return 'Invalid Date';
    return d.toLocaleDateString(undefined,opts); 
}

function getCurrentPayPeriod() {
  let today = new Date();
  let y = today.getFullYear(), m = today.getMonth();
  let day = today.getDate();
  let start, end;
  if (day > 25) {
    start = new Date(y, m, 26);
    end = new Date(y, m + 1, 25, 23, 59, 59, 999);
  } else {
    start = new Date(y, m - 1, 26);
    end = new Date(y, m, 25, 23, 59, 59, 999);
  }
  return { start, end };
}
