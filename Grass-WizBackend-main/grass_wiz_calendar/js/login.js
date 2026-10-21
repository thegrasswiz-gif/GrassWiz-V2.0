// Login page behaviour (sign in + "forgot password" email)

const $ = id => document.getElementById(id);
let mode = 'signin';   // 'signin' | 'forgot'

// Match the theme the user picked inside the app
try {
  document.body.className = (localStorage.getItem('gw_theme') || 'theme-grasswiz') + ' auth-page';
  if (localStorage.getItem('gw_darkMode') === 'true') document.body.classList.add('dark-mode');
} catch (e) { /* storage unavailable — keep defaults */ }

function showMsg(text, type) {
  const el = $('msg');
  el.textContent = text || '';
  el.className = 'auth-msg' + (text ? ' show ' + type : '');
}

function setMode(next) {
  mode = next;
  const forgot = mode === 'forgot';
  $('formTitle').textContent = forgot ? 'Reset your password' : 'Welcome back';
  $('formSub').textContent = forgot ? "Enter your email and we'll send you a reset link." : 'Sign in to manage jobs, team and payroll.';
  $('pwField').style.display = forgot ? 'none' : '';
  $('password').required = !forgot;
  $('submitBtn').textContent = forgot ? 'Send reset link' : 'Sign in';
  $('modeLink').textContent = forgot ? 'Back to sign in' : 'Forgot your password?';
  showMsg('');
}

$('modeLink').onclick = () => setMode(mode === 'signin' ? 'forgot' : 'signin');

$('pwToggle').onclick = () => {
  const show = $('password').type === 'password';
  $('password').type = show ? 'text' : 'password';
  $('pwToggle').innerHTML = show ? '<i class="fas fa-eye-slash"></i>' : '<i class="fas fa-eye"></i>';
  $('pwToggle').setAttribute('aria-label', show ? 'Hide password' : 'Show password');
};

$('loginForm').onsubmit = async (e) => {
  e.preventDefault();
  const email = $('email').value.trim();
  const password = $('password').value;
  if (!email || (mode === 'signin' && !password)) {
    showMsg(mode === 'signin' ? 'Enter your email and password.' : 'Enter your email address.', 'error');
    return;
  }
  const btn = $('submitBtn');
  const label = btn.textContent;
  btn.disabled = true; btn.textContent = 'Please wait…';
  showMsg('');
  try {
    if (mode === 'signin') {
      await signIn(email, password);
      location.replace(APP_PAGE);
      return;
    }
    const redirectTo = new URL('reset-password.html', location.href).href;
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) throw error;
    // Same message whether or not the account exists (don't reveal who has an account)
    showMsg('If that email has an account, a reset link is on its way.', 'ok');
  } catch (err) {
    showMsg(friendlyAuthMessage(err), 'error');
  }
  btn.disabled = false; btn.textContent = label;
};

redirectIfSignedIn();
