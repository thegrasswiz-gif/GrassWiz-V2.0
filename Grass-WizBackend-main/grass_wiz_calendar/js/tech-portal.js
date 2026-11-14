// Tech portal (tech.html): technicians sign in, see today's jobs assigned to
// them and mark them complete with closing remarks.
// Access control lives in the database (sql/06-tech-portal.sql): a technician
// login can only read their own jobs and can only complete them through
// gw_complete_my_job() — this file decides what the page shows.

// Techs without a real email sign in with a username; the office sets the
// employee record's Email and the Auth user to <username> + TECH_LOGIN_DOMAIN
// (defined in utils.js — a synthetic address, no real mailbox needed).

let techName = null;
let techJobs = [];
let portalJobId = null;

function showScreen(which) {
    $('loginScreen').style.display = which === 'login' ? 'flex' : 'none';
    $('notechScreen').style.display = which === 'notech' ? 'flex' : 'none';
    $('dashboard').style.display = which === 'dashboard' ? 'flex' : 'none';
}

document.addEventListener('DOMContentLoaded', async () => {
    $('loginForm').onsubmit = portalLogin;
    const session = await getSession();
    if (!session) { showScreen('login'); return; }
    await identifyTech(session);
});

async function portalLogin(e) {
    e.preventDefault();
    const btn = $('loginBtn');
    btn.disabled = true;
    $('loginMsg').textContent = '';
    try {
        let ident = $('email').value.trim().toLowerCase();
        if (!ident.includes('@')) ident = ident.replace(/[^a-z0-9._-]/g, '') + TECH_LOGIN_DOMAIN;
        await signIn(ident, $('password').value);
        const session = await getSession();
        if (session) await identifyTech(session);
    } catch (err) {
        $('loginMsg').textContent = friendlyAuthMessage(err);
    } finally {
        btn.disabled = false;
    }
}

// Who is this account on the team list? NULL = office account, not a tech
async function identifyTech(session) {
    const { data: name, error } = await sb.rpc('gw_my_tech_name');
    if (error) {
        showScreen('login');
        $('loginMsg').textContent = 'The tech portal needs a database update: run sql/06-tech-portal.sql in Supabase.';
        return;
    }
    if (!name) {
        $('notechEmail').textContent = session.user.email;
        showScreen('notech');
        return;
    }
    techName = name;
    $('welcomeText').textContent = 'Hi, ' + name.split(' ')[0];
    $('dateText').textContent = fmtDate(todayISO());
    showScreen('dashboard');
    await loadPortalJobs();
}

window.portalLogout = async () => { await signOut(); };

async function loadPortalJobs() {
    const list = $('jobList');
    list.innerHTML = '<div class="empty-state"><i class="fas fa-spinner fa-spin"></i><p>Loading…</p></div>';
    try {
        // The database already limits this to the tech's own jobs
        const all = await sbFetchJobs();
        techJobs = all
            .filter(j => j.date === todayISO() && j.technician === techName && j.status !== 'Cancelled')
            .sort((a, b) => (a.time || '').localeCompare(b.time || '') || a.customer.localeCompare(b.customer));
    } catch (err) {
        console.error(err);
        list.innerHTML = '<div class="empty-state"><i class="fas fa-triangle-exclamation" style="color:#ef4444;"></i><h3>Could not load jobs</h3><p>Check your connection and pull to refresh.</p></div>';
        return;
    }
    renderPortalJobs();
}

function renderPortalJobs() {
    const list = $('jobList');
    const done = techJobs.filter(j => j.status === 'Completed').length;
    $('progressPill').textContent = `${done} of ${techJobs.length} done`;
    $('progressPill').style.display = techJobs.length ? 'inline-block' : 'none';

    if (!techJobs.length) {
        list.innerHTML = `<div class="empty-state">
            <i class="fas fa-check-circle"></i>
            <h3>Nothing on today</h3>
            <p>No jobs are assigned to you today.</p>
        </div>`;
        return;
    }

    list.innerHTML = '';
    techJobs.forEach(job => {
        const isDone = job.status === 'Completed';
        const card = document.createElement('div');
        card.className = 'job-card' + (isDone ? ' done' : '');
        card.onclick = () => openPortalJob(job.id);
        card.innerHTML = `
            <span class="time">${isDone ? '<i class="fas fa-check-circle"></i> DONE' : esc(job.time || 'Any time')}
                ${job.kind === 'inspection' ? '<span class="kind-badge">Inspection</span>' : ''}</span>
            <h3>${esc(job.customer)}</h3>
            <p><i class="fas fa-map-marker-alt" style="color:var(--primary);"></i> ${esc(job.address)}</p>`;
        list.appendChild(card);
    });
}

function openPortalJob(jobId) {
    const job = techJobs.find(j => j.id === jobId);
    if (!job) return;
    portalJobId = jobId;

    const isDone = job.status === 'Completed';
    const isInsp = job.kind === 'inspection';
    $('modalTitle').textContent = isInsp ? 'Inspection' : 'Job Order';

    const services = [job.servicesRequired, job.otherService].filter(Boolean).join(', ');
    const mapLink = 'https://maps.google.com/?q=' + encodeURIComponent(job.address);
    const telLink = 'tel:' + String(job.phone || '').replace(/[^0-9+]/g, '');

    const info = (label, value, style) =>
        value ? `<div class="info-group"><label>${label}</label><p ${style ? 'style="' + style + '"' : ''}>${esc(value)}</p></div>` : '';

    $('modalContent').innerHTML = `
        <div class="info-group"><label>Customer</label><p>${esc(job.customer)}</p></div>

        <div class="action-buttons">
            ${job.phone ? `<a href="${telLink}" class="btn-call"><i class="fas fa-phone"></i> Call</a>` : ''}
            ${job.address ? `<a href="${mapLink}" target="_blank" class="btn-map"><i class="fas fa-diamond-turn-right"></i> Directions</a>` : ''}
        </div>

        ${info('Address', job.address)}
        ${info('Directions', job.directions, 'font-weight:400; color:var(--text-muted);')}
        ${info('Property', job.propertyAreas)}
        ${info('Services Required', services)}
        ${info(isInsp ? 'Notes' : 'Customer Notes', job.customerRemarks, 'font-weight:400; color:#b91c1c; background:#fee2e2; padding:10px; border-radius:8px;')}
        ${info('Time', job.time ? job.time + (job.duration ? ' · ' + job.duration + ' hr' : '') : '')}

        ${isDone
            ? `<div class="done-banner"><i class="fas fa-check-circle"></i> Completed</div>
               ${info('Closing Remarks', job.closingRemarks)}`
            : `<div class="notes-section">
                   <label style="font-size:12px; font-weight:800; text-transform:uppercase; color:var(--text-muted);">Closing Remarks *</label>
                   <textarea id="closingNotes" placeholder="e.g. Lawn finished. Gate locked."></textarea>
                   <button class="btn-complete" id="completeBtn" onclick="completePortalJob()">
                       <i class="fas fa-check-circle"></i> Complete Job
                   </button>
               </div>`}
    `;

    $('jobModal').classList.add('open');
}

window.closePortalModal = () => {
    $('jobModal').classList.remove('open');
    portalJobId = null;
};

window.completePortalJob = async () => {
    const notes = $('closingNotes').value.trim();
    if (!notes) { alert('Please enter closing remarks before completing the job.'); return; }

    const btn = $('completeBtn');
    btn.disabled = true;
    try {
        // Server-side: only succeeds on a job assigned to this technician
        const { data: ok, error } = await sb.rpc('gw_complete_my_job', {
            p_job_id: portalJobId,
            p_remarks: notes
        });
        if (error) throw error;
        if (!ok) { alert('This job could not be completed. It may have been changed by the office — reload the page.'); return; }

        const job = techJobs.find(j => j.id === portalJobId);
        if (job) { job.status = 'Completed'; job.closingRemarks = notes; }
        closePortalModal();
        renderPortalJobs();
    } catch (err) {
        console.error(err);
        alert('Could not save. Check your connection and try again.');
        btn.disabled = false;
    }
};

// PWA: service worker makes the portal installable and opens offline
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(err => console.warn('SW registration failed:', err));
}
