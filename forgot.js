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

/* ---------- Module 5: personal Dashboard (only the logged-in user's blogs) ---------- */
(function () {
  let cache = null, cacheUid = null, loadedAt = 0, loading = false;
  function load() {
    if (cacheUid !== uid) { cache = null; cacheUid = uid; loadedAt = 0; }
    if (loading || Date.now() - loadedAt < 4000) return;
    loading = true;
    // GET /api/blogs/mine: the server returns only the signed-in user's blogs
    window.api.get('/blogs/mine').then(r => { cache = r.blogs; loadedAt = Date.now(); })
      .catch(() => {}).then(() => { loading = false; if (R() === 'dashboard') refresh(); });
  }
  function dash() {
    if (!S.ready.posts) return '<div class="grid"><div class="sk"></div><div class="sk"></div><div class="sk"></div></div>';
    load();
    const mine = (cache || S.posts.filter(p => p.author === uid)).slice().sort((a, b) => b.updatedAt - a.updatedAt);
    const sum = col => mine.reduce((n, p) => n + cnt(col, p.id), 0);
    const tile = (n, l) => '<div class="box" style="text-align:center;margin:0"><div style="font-size:28px;font-weight:700">' + n + '</div><div class="mu">' + l + '</div></div>';
    return '<div class="hero"><h1>Your dashboard</h1><p>Signed in as <b>' + esc(me.name) + '</b> (@' + esc(uid) + '). Only your own blogs are shown here.</p>' +
      '<div class="row"><button class="b" data-a="new">✍ New blog</button><button class="b g" data-a="nav" data-i="profile">My profile</button><button class="b g" data-a="out">Logout</button></div></div>' +
      '<div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(130px,1fr));margin-bottom:8px">' +
      tile(mine.length, 'My blogs') + tile(mine.filter(p => p.status === 'published').length, 'Published') +
      tile(mine.filter(p => p.status === 'draft').length, 'Drafts') + tile(sum(S.likes), 'Likes') +
      tile(sum(S.views), 'Views') + tile(sum(S.comments), 'Comments') + '</div>' +
      '<h3>My blogs</h3>' + grid(mine);
  }
  const origView = window.view, origRender = window.render;
  window.view = function () { return R() === 'dashboard' ? dash() : origView.apply(this, arguments); };
  window.render = function () {
    origRender.apply(this, arguments);
    const nav = document.querySelector('.nav');
    if (!nav || nav.querySelector('[data-i="dashboard"]')) return;
    const a = document.createElement('a');
    a.href = '#dashboard'; a.dataset.a = 'nav'; a.dataset.i = 'dashboard'; a.textContent = 'Dashboard';
    if (R() === 'dashboard') a.className = 'on';
    const home = nav.querySelector('[data-i="home"]');
    home ? home.after(a) : nav.prepend(a);
  };
})();
/* ---------- Mobile menu behind a three-dots button ---------- */
(function () {
  const css = document.createElement('style');
  css.textContent =
    '.menu-btn{display:none;font-size:20px;line-height:1;padding:6px 12px}' +
    '#menu-bd{display:none}' +
    '@media(max-width:760px){' +
    '.menu-btn{display:inline-block}' +
    '.side{position:fixed!important;top:0;right:0;left:auto!important;bottom:0;width:230px!important;height:100vh!important;z-index:40;transform:translateX(110%);transition:transform .25s;overflow-y:auto;border:0!important;border-left:1px solid var(--bd)!important;padding:14px 10px!important}' +
    '.side.open{transform:none;box-shadow:0 0 30px rgba(0,0,0,.35)}' +
    '.nav{display:block!important}' +
    '.nav a,.nav button{width:100%!important;white-space:normal!important;padding:10px 12px!important;font-size:15px!important}' +
    '#menu-bd.show{display:block;position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:35}' +
    '.top .mu{display:none}.wrap{padding:12px}.grid{grid-template-columns:1fr}}';
  document.head.appendChild(css);
  const bd = document.createElement('div');
  bd.id = 'menu-bd';
  document.body.appendChild(bd);
  let open = false;
  function apply() {
    const side = document.querySelector('.side');
    if (side) side.classList.toggle('open', open);
    bd.classList.toggle('show', open);
  }
  const origRender = window.render;
  window.render = function () {
    origRender.apply(this, arguments);
    const top = document.querySelector('.top');
    if (top && !top.querySelector('.menu-btn')) {
      const b = document.createElement('button');
      b.className = 'b g menu-btn';
      b.setAttribute('data-menu', '1');
      b.setAttribute('aria-label', 'Menu');
      b.textContent = '⋮';
      top.append(b);
    }
    apply();
  };
  document.addEventListener('click', e => {
    if (e.target.closest('[data-menu]')) { open = !open; apply(); return; }
    if (e.target === bd || e.target.closest('.nav a, .nav button')) { open = false; apply(); }
  }, true);
  window.addEventListener('resize', () => { if (innerWidth > 760 && open) { open = false; apply(); } });
})();
