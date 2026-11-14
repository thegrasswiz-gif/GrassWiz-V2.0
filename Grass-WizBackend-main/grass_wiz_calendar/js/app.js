// App shell: top-level navigation between the Calendar, Inspections, Team and Action List views

// Show one of the three main views ('calendar' | 'team' | 'actions') and set the header to match
function showView(name) {
  const views = { calendar: 'viewCalendar', team: 'viewTeam', actions: 'viewActionList', inspections: 'viewInspections', customers: 'viewCustomers' };
  Object.keys(views).forEach(k => $(views[k]).classList.toggle('active', k === name));
  // The action lists belong to the calendar section, so the Calendar tab stays highlighted
  $('navCalendar').classList.toggle('active', name === 'calendar' || name === 'actions');
  $('navInspections').classList.toggle('active', name === 'inspections');
  $('navCustomers').classList.toggle('active', name === 'customers');
  $('navTeam').classList.toggle('active', name === 'team');
  $('searchContainer').style.display = name === 'calendar' ? 'block' : 'none';
  $('addBtn').style.display = (name === 'team' || name === 'inspections' || name === 'customers') ? 'none' : 'inline-flex';
}


// Event wiring — called once from app.js after the user is signed in.
function initApp() {

  $('navCalendar').onclick = () => { showView('calendar'); fetchJobs(); };
  $('navTeam').onclick = () => { showView('team'); fetchTechnicians(); };

  $('tabUpcoming').onclick = () => {
    sidebarMode = 'upcoming';
    $('tabUpcoming').classList.add('active'); $('tabSelected').classList.remove('active');
    $('upcomingList').classList.remove('hidden'); $('jobList').classList.add('hidden');
    $('addSelectedBtn').classList.add('hidden');
    updateSidebar();
  };
  $('tabSelected').onclick = () => {
    sidebarMode = 'selected';
    $('tabSelected').classList.add('active'); $('tabUpcoming').classList.remove('active');
    $('jobList').classList.remove('hidden'); $('upcomingList').classList.add('hidden');
    $('addSelectedBtn').classList.remove('hidden');
    updateSidebar();
  };
}

// ---- Boot: runs on every load of index.html ----
document.addEventListener('DOMContentLoaded', async () => {
  const session = await requireAuth();      // not signed in -> redirected to login.html
  if (!session) return;

  $('userEmail').textContent = session.user.email;
  $('logoutBtn').onclick = signOut;
  $('topTodayDate').textContent = "Today is: " + new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  initTheme();
  initParishSelects();
  initApp();
  initCalendar();
  initJobs();
  initTeam();
  initPayroll();
  initActions();
  initInspections();
  initCustomerUI();
  initCustomersTab();

  fetchCustomers().then(() => fetchJobs());
  fetchTechnicians();

  document.documentElement.classList.remove('auth-pending');
});
