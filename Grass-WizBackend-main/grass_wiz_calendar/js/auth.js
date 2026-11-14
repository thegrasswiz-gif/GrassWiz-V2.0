// Authentication (Supabase Auth, email + password)
// The real protection is Row Level Security in the database (sql/02-auth-policies.sql).
// This file only decides which page the browser shows.

const LOGIN_PAGE = 'login.html';
const APP_PAGE = 'index.html';

async function getSession() {
  const { data } = await sb.auth.getSession();
  return data.session;
}

// Call on protected pages. Redirects to the login page when nobody is signed in.
async function requireAuth() {
  const session = await getSession();
  if (!session) { location.replace(LOGIN_PAGE); return null; }
  // Technicians get the portal, not the office app. Admins keep full access even
  // when they are also on the team list. (No-op before sql/06-tech-portal.sql.)
  try {
    const [{ data: techName }, { data: isAdmin }] = await Promise.all([
      sb.rpc('gw_my_tech_name'), sb.rpc('gw_is_admin')]);
    if (techName && !isAdmin) { location.replace('tech.html'); return null; }
  } catch (e) { /* older database without the portal functions: carry on */ }
  sb.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') location.replace(LOGIN_PAGE);
  });
  return session;
}

// Call on the login page. Skips straight to the app when already signed in.
async function redirectIfSignedIn() {
  if (await getSession()) location.replace(APP_PAGE);
}

async function signIn(email, password) {
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

async function signOut() {
  await sb.auth.signOut();
  location.replace(LOGIN_PAGE);
}

// True (and signs out) when an API error means the session is no longer valid.
function handleAuthError(err) {
  const msg = String((err && (err.message || err.code)) || '');
  if (err && (err.status === 401 || /JWT|PGRST30[0-9]/i.test(msg))) {
    signOut();
    return true;
  }
  return false;
}

function friendlyAuthMessage(err) {
  const m = String((err && err.message) || '');
  if (/invalid login credentials/i.test(m)) return 'Incorrect email or password.';
  if (/email not confirmed/i.test(m)) return 'This account has not been confirmed yet. Check your email for the confirmation link.';
  if (/rate limit|too many/i.test(m)) return 'Too many attempts. Please wait a minute and try again.';
  if (/failed to fetch|network/i.test(m)) return 'Cannot reach the server. Check your internet connection.';
  return m || 'Something went wrong. Please try again.';
}
