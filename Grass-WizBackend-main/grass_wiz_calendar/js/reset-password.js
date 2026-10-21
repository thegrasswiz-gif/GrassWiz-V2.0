// Reached from the password-reset email link. Supabase puts a recovery session in the URL;
// once it is picked up we let the user choose a new password.

const $ = id => document.getElementById(id);

try {
  document.body.className = (localStorage.getItem('gw_theme') || 'theme-grasswiz') + ' auth-page';
  if (localStorage.getItem('gw_darkMode') === 'true') document.body.classList.add('dark-mode');
} catch (e) { /* ignore */ }

function showMsg(text, type) {
  const el = $('msg');
  el.textContent = text || '';
  el.className = 'auth-msg' + (text ? ' show ' + type : '');
}

let ready = false;
sb.auth.onAuthStateChange((event) => { if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') ready = true; });
// If the link was already consumed, check for a session directly; otherwise tell the user it is invalid.
setTimeout(async () => {
  if (!ready && !(await getSession())) {
    showMsg('This reset link is invalid or has expired. Request a new one from the sign-in page.', 'error');
    $('submitBtn').disabled = true;
  }
}, 1500);

$('resetForm').onsubmit = async (e) => {
  e.preventDefault();
  const pw = $('password').value, pw2 = $('password2').value;
  if (pw.length < 8) return showMsg('Password must be at least 8 characters.', 'error');
  if (pw !== pw2) return showMsg('Passwords do not match.', 'error');
  const btn = $('submitBtn');
  btn.disabled = true; btn.textContent = 'Updating…';
  const { error } = await sb.auth.updateUser({ password: pw });
  if (error) {
    showMsg(friendlyAuthMessage(error), 'error');
    btn.disabled = false; btn.textContent = 'Update password';
    return;
  }
  showMsg('Password updated. Taking you to the app…', 'ok');
  setTimeout(() => location.replace(APP_PAGE), 1200);
};
