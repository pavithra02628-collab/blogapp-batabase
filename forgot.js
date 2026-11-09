/* Forgot-password and reset-password screens for Inkwell (loaded after the main script). */
(function () {
  const BASE = (window.INKWELL_API_URL || '').replace(/\/$/, '') + '/api';
  const token = new URLSearchParams(location.search).get('reset');
  let done = false;
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
  function showForgot() {
    box('<h3>Forgot password</h3><p class="mu">Enter your account email and we will send you a reset link.</p>' +
      '<label>Email</label><input id="fp-em" type="email" style="width:100%">' +
      '<p><button class="b" id="fp-go" style="width:100%">Send reset link</button></p>' +
      '<p class="mu"><a href="#" id="fp-back">Back to sign in</a></p>');
    el('fp-back').onclick = e => { e.preventDefault(); window.showAuth('in'); };
    el('fp-go').onclick = () => busy(el('fp-go'), async () => {
      const email = el('fp-em').value.trim();
      if (!email) throw new Error('Enter your email');
      const r = await post('/auth/forgot-password', { email });
      toast(r.message);
      box('<h3>Check your email</h3><p>' + r.message.replace(/</g, '&lt;') + '</p><p class="mu">The link works for 30 minutes. Check your spam folder too.</p><p><a href="#" id="fp-back2">Back to sign in</a></p>');
      el('fp-back2').onclick = e => { e.preventDefault(); window.showAuth('in'); };
    });
  }
  function showReset() {
    box('<h3>Choose a new password</h3>' +
      '<label>New password</label><div class="row"><input id="rp-pw" type="password" style="flex:1"><button class="b g" id="rp-eye">Show</button></div>' +
      '<label>Confirm new password</label><input id="rp-pc" type="password" style="width:100%">' +
      '<p><button class="b" id="rp-go" style="width:100%">Update password</button></p>');
    el('rp-eye').onclick = () => { const t = el('rp-pw').type === 'password' ? 'text' : 'password'; el('rp-pw').type = t; el('rp-pc').type = t; el('rp-eye').textContent = t === 'text' ? 'Hide' : 'Show'; };
    el('rp-go').onclick = () => busy(el('rp-go'), async () => {
      const pw = el('rp-pw').value;
      if (pw.length < 8) throw new Error('Password needs 8+ characters');
      if (pw !== el('rp-pc').value) throw new Error('Passwords do not match');
      const r = await post('/auth/reset-password', { token, password: pw });
      done = true;
      history.replaceState(null, '', location.pathname);
      toast(r.message);
      window.showAuth('in');
    });
  }
  // "Forgot password?" link on the sign-in screen
  document.addEventListener('click', e => {
    const t = e.target.closest('[data-au="forgot"]');
    if (t) { e.preventDefault(); e.stopImmediatePropagation(); showForgot(); }
  }, true);
  // Opened from the email link: show the reset screen instead of the normal start screen
  if (token) {
    const origShow = window.showAuth, origEnter = window.enter;
    window.showAuth = function (t) { if (!done) showReset(); else origShow(t); };
    window.enter = function () { if (done) return origEnter.apply(this, arguments); };
    showReset();
  }
})();
