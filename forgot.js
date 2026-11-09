/* Forgot password with a one-time code (OTP) for Inkwell (loaded after the main script). */
(function () {
  const BASE = (window.INKWELL_API_URL || '').replace(/\/$/, '') + '/api';
  const el = id => document.getElementById(id);
  async function post(url, body) {
    let r;
    try { r = await fetch(BASE + url, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); }
    catch (e) { throw new Error('Cannot reach the server'); }
    let j = {}; try { j = await r.json(); } catch (e) {}
    if (!r.ok) throw new Error(j.error || 'Request failed');
    return j;
  }
  function box(inner) {
    el('root').innerHTML = '<div class="wrap" style="max-width:430px"><div class="box"><h2>✒ Inkwell</h2>' + inner + '</div></div>';
  }
  function busy(btn, fn) {
    btn.disabled = true;
    fn().catch(e => toast(e.message || 'Something went wrong')).then(() => { btn.disabled = false; });
  }
  const back = id => { el(id).onclick = e => { e.preventDefault(); window.showAuth('in'); }; };

  // Step 1: ask for the email
  function showForgot() {
    box('<h3>Forgot password</h3><p class="mu">Enter your account email. We will send you a 6-digit code.</p>' +
      '<label>Email</label><input id="fp-em" type="email" style="width:100%">' +
      '<p><button class="b" id="fp-go" style="width:100%">Send code</button></p>' +
      '<p class="mu"><a href="#" id="fp-back">Back to sign in</a></p>');
    back('fp-back');
    el('fp-go').onclick = () => busy(el('fp-go'), async () => {
      const email = el('fp-em').value.trim();
      if (!email) throw new Error('Enter your email');
      const r = await post('/auth/forgot-password', { email });
      toast(r.message);
      showVerify(email);
    });
  }

  // Step 2: enter the code (and optionally a new password), then sign in
  function showVerify(email) {
    box('<h3>Enter your code</h3><p class="mu">We sent a 6-digit code to <b>' + email.replace(/[&<>"]/g, '') + '</b>. It works for 15 minutes. Check your spam folder too.</p>' +
      '<label>6-digit code</label><input id="vo-otp" inputmode="numeric" autocomplete="one-time-code" maxlength="6" style="width:100%;font-size:22px;letter-spacing:6px;text-align:center">' +
      '<label>New password <span class="mu">(optional, 8+ characters)</span></label><div class="row"><input id="vo-pw" type="password" style="flex:1"><button class="b g" id="vo-eye">Show</button></div>' +
      '<p class="mu">Leave it empty to just sign in. Set one here if you forgot your password.</p>' +
      '<p><button class="b" id="vo-go" style="width:100%">Verify and sign in</button></p>' +
      '<p class="mu"><a href="#" id="vo-resend">Send a new code</a> · <a href="#" id="vo-back">Back to sign in</a></p>');
    back('vo-back');
    el('vo-eye').onclick = () => { const t = el('vo-pw').type === 'password' ? 'text' : 'password'; el('vo-pw').type = t; el('vo-eye').textContent = t === 'text' ? 'Hide' : 'Show'; };
    el('vo-resend').onclick = e => {
      e.preventDefault();
      post('/auth/forgot-password', { email }).then(r => toast('A new code was requested. Wait a minute between requests.')).catch(err => toast(err.message));
    };
    el('vo-go').onclick = () => busy(el('vo-go'), async () => {
      const otp = el('vo-otp').value.replace(/\D/g, ''), password = el('vo-pw').value;
      if (otp.length !== 6) throw new Error('Enter the 6-digit code');
      const r = await post('/auth/verify-otp', { email, otp, password });
      toast(password ? 'Password updated. You are signed in.' : 'Verified. You are signed in.');
      window.enter(r.user.id, r.user);
    });
  }

  // "Forgot password?" link on the sign-in screen
  document.addEventListener('click', e => {
    const t = e.target.closest('[data-au="forgot"]');
    if (t) { e.preventDefault(); e.stopImmediatePropagation(); showForgot(); }
  }, true);
})();
