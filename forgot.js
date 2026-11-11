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
    '.side{position:fixed!important;top:0;left:0;right:auto!important;bottom:0;width:230px!important;height:100vh!important;z-index:40;transform:translateX(-110%);transition:transform .25s;overflow-y:auto;border:0!important;border-right:1px solid var(--bd)!important;padding:14px 10px!important}' +
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
      top.prepend(b);
    }
    apply();
  };
  document.addEventListener('click', e => {
    if (e.target.closest('[data-menu]')) { open = !open; apply(); return; }
    if (e.target === bd || e.target.closest('.nav a, .nav button')) { open = false; apply(); }
  }, true);
  window.addEventListener('resize', () => { if (innerWidth > 760 && open) { open = false; apply(); } });
})();/* Forgot password with a one-time code (OTP) for Inkwell (loaded after the main script). */
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
    '.side{position:fixed!important;top:0;left:0;right:auto!important;bottom:0;width:230px!important;height:100vh!important;z-index:40;transform:translateX(-110%);transition:transform .25s;overflow-y:auto;border:0!important;border-right:1px solid var(--bd)!important;padding:14px 10px!important}' +
    '.side.open{transform:none;box-shadow:0 0 30px rgba(0,0,0,.35)}' +
    '.nav{display:block!important}' +
    '.nav a,.nav button{width:100%!important;white-space:normal!important;padding:10px 12px!important;font-size:15px!important}' +
    '#menu-bd.show{display:block;position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:35}' +
    '.top .mu,.top [data-a="out"]{display:none}.top{padding:8px 10px!important;gap:6px!important}.top input{min-width:0}.wrap{padding:12px}.grid{grid-template-columns:1fr}}';
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
      top.prepend(b);
    }
    apply();
  };
  document.addEventListener('click', e => {
    if (e.target.closest('[data-menu]')) { open = !open; apply(); return; }
    if (e.target === bd || e.target.closest('.nav a, .nav button')) { open = false; apply(); }
  }, true);
  window.addEventListener('resize', () => { if (innerWidth > 760 && open) { open = false; apply(); } });
})();

/* ---------- Final polish: landing page, reading page, footer, empty states, delete popup, accessibility ---------- */
(function () {
  const GITHUB = 'https://github.com/pavithra02628-collab/blogapp-batabase'; // change to your repository link
  const LINKEDIN = ''; // paste your LinkedIn profile link here to show it in the footer
  const el = id => document.getElementById(id);

  // ---- styles ----
  const css = document.createElement('style');
  css.textContent =
    ':focus-visible{outline:3px solid var(--ac);outline-offset:2px}' +
    '.row>input{min-width:0}' +
    '@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}' +
    '#toast div{border-left:5px solid var(--ac);max-width:min(340px,86vw);animation:fi .25s}#toast div.err{border-left-color:#dc2626}' +
    '.post{max-width:720px;margin:0 auto;font-size:16.5px;line-height:1.8}' +
    '.post h1{font-size:clamp(26px,5vw,38px);line-height:1.2;margin:.3em 0}.post h2{margin-top:1.4em}' +
    '.post blockquote{border-left:4px solid var(--ac);margin:1em 0;padding:.2em 1em;color:var(--mu)}' +
    '.author-box{max-width:720px;margin:20px auto;display:flex;gap:14px;align-items:center}' +
    '.avatar{width:52px;height:52px;border-radius:50%;background:var(--ac);color:#fff;display:grid;place-items:center;font-size:22px;font-weight:700;flex:none}' +
    '.related{margin:28px auto 0}' +
    '.site-foot{margin-top:40px;padding:20px 0 14px;border-top:1px solid var(--bd);text-align:center;color:var(--mu);font-size:13px}.site-foot a{color:var(--mu);margin:0 8px}' +
    '.empty .big{font-size:44px}.empty h3{margin:8px 0 4px;color:var(--tx)}.empty p{margin:0 0 14px}' +
    '.modal-bd{position:fixed;inset:0;background:rgba(0,0,0,.5);display:grid;place-items:center;z-index:60;padding:16px}' +
    '.modal{background:var(--card);color:var(--tx);border-radius:16px;padding:22px;max-width:380px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,.4);animation:fi .2s}' +
    '.land-hero{display:grid;grid-template-columns:1.1fr .9fr;gap:28px;align-items:center;max-width:1000px;margin:0 auto;padding:32px 20px 10px}' +
    '.land-hero h1{font-size:clamp(32px,6vw,52px);line-height:1.08;margin:.3em 0}' +
    '.land-sec{max-width:1000px;margin:26px auto;padding:0 20px}' +
    '.land-feats{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:14px}' +
    '.land-feats .box{margin:0}.land-feats .ico{font-size:28px}' +
    '@media(max-width:760px){.land-hero{grid-template-columns:1fr;padding-top:20px}}';
  document.head.appendChild(css);
  if (!document.querySelector('link[rel~="icon"]')) {
    const l = document.createElement('link');
    l.rel = 'icon';
    l.href = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ctext y='.9em' font-size='90'%3E%E2%9C%92%3C/text%3E%3C/svg%3E";
    document.head.appendChild(l);
  }

  // ---- nicer default cover art (used when a blog has no cover image) ----
  window.cov = function (p) {
    if (p.cover) return "background-image:url('" + esc(p.cover) + "')";
    let h = 0;
    for (const c of (p.title || '') + (p.category || '')) h = (h * 31 + c.charCodeAt(0)) % 360;
    const hsl = (x, s, l) => 'hsl(' + x + ',' + s + '%,' + l + '%)';
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 200" preserveAspectRatio="xMidYMid slice">' +
      '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + hsl(h, 70, 56) + '"/><stop offset="1" stop-color="' + hsl((h + 55) % 360, 72, 46) + '"/></linearGradient></defs>' +
      '<rect width="400" height="200" fill="url(#g)"/><circle cx="330" cy="40" r="90" fill="' + hsl((h + 120) % 360, 80, 70) + '" opacity=".28"/>' +
      '<circle cx="60" cy="190" r="110" fill="#fff" opacity=".12"/><path d="M0 150 Q100 110 200 150 T400 130 V200 H0Z" fill="#fff" opacity=".14"/></svg>';
    return "background-image:url('data:image/svg+xml," + encodeURIComponent(svg) + "');background-size:cover;background-position:center";
  };

  // ---- friendly empty states and a 404 page ----
  const origGrid = window.grid;
  window.grid = function (list) {
    if (list && list.length) return origGrid.apply(this, arguments);
    const r = R();
    let e = ['📝', 'Nothing here yet', 'Be the first to write something.', 'new', '✍ Write a blog'];
    if (r === 'mine' || r === 'dashboard') e = ['📝', "You haven't written a blog yet", 'Your stories will appear here. Start with your first one.', 'new', '✍ Write a blog'];
    else if (r === 'bookmarks') e = ['🔖', 'No bookmarks yet', 'Tap “Save” on any blog to keep it here.', 'goex', 'Explore blogs'];
    else if (r === 'explore' || r === 'categories') e = ['🔍', 'No blogs found', S.q || S.cat ? 'Try a different search or category.' : 'No blogs have been published yet.', 'new', '✍ Write a blog'];
    return '<div class="empty"><div class="big">' + e[0] + '</div><h3>' + e[1] + '</h3><p>' + e[2] + '</p><button class="b" data-a="' + e[3] + '">' + e[4] + '</button></div>';
  };
  const origView = window.view;
  window.view = function () {
    const h = origView.apply(this, arguments);
    return typeof h === 'string' && h.indexOf('Page not found.') > -1
      ? '<div class="empty"><div class="big">🧭</div><h3>Page not found</h3><p>That page does not exist or was moved.</p><button class="b" data-a="nav" data-i="home">Go home</button></div>'
      : h;
  };

  // ---- footer ----
  function footer() {
    const f = document.createElement('footer');
    f.className = 'site-foot';
    f.innerHTML = '<div><b>✒ Inkwell</b> · A full-stack blog built with Node.js, Express and MongoDB</div>' +
      '<div style="margin-top:6px"><a href="' + GITHUB + '" target="_blank" rel="noopener">GitHub</a>' +
      (LINKEDIN ? '<a href="' + LINKEDIN + '" target="_blank" rel="noopener">LinkedIn</a>' : '') + '</div>' +
      '<div style="margin-top:6px">© ' + new Date().getFullYear() + ' Inkwell</div>';
    return f;
  }

  // ---- reading page: reading time, author box, related blogs ----
  function decoratePost() {
    const p = S.posts.find(x => x.id === R().slice(5)), post = document.querySelector('.main .post');
    if (!p || !post || (post.nextElementSibling && post.nextElementSibling.classList.contains('author-box'))) return;
    const words = plain(p.content).trim().split(/\s+/).filter(Boolean).length, mins = Math.max(1, Math.round(words / 200));
    const meta = post.querySelector('.mu');
    if (meta) meta.textContent += ' · ' + mins + ' min read';
    const count = S.posts.filter(x => x.author === p.author && x.status === 'published').length;
    const box = document.createElement('div');
    box.className = 'box author-box';
    box.innerHTML = '<div class="avatar">' + esc((nm(p.author) || '?')[0].toUpperCase()) + '</div><div><b>' + esc(nm(p.author)) +
      '</b><div class="mu">' + count + ' published blog' + (count === 1 ? '' : 's') + ' · @' + esc(p.author) + '</div></div>';
    post.after(box);
    const others = pub().filter(x => x.id !== p.id).sort((a, b) => (b.category === p.category) - (a.category === p.category) || b.createdAt - a.createdAt).slice(0, 3);
    if (others.length) {
      const sec = document.createElement('div');
      sec.className = 'related';
      sec.innerHTML = '<h3>More to read</h3>' + grid(others);
      post.parentElement.append(sec);
    }
  }

  // ---- page titles, accessibility labels, footer (runs after every render) ----
  const TITLES = { home: 'Home', dashboard: 'Dashboard', explore: 'Explore blogs', mine: 'My blogs', create: 'Write a blog', categories: 'Categories', bookmarks: 'Bookmarks', profile: 'Profile', settings: 'Settings' };
  function enhance() {
    const r = R();
    let t = TITLES[r];
    if (r.startsWith('post-')) { const p = S.posts.find(x => x.id === r.slice(5)); t = p ? p.title : 'Blog'; }
    document.title = (t ? t + ' – ' : '') + 'Inkwell';
    const q = el('q'); if (q) q.setAttribute('aria-label', 'Search blogs');
    const m = document.querySelector('[data-a="mode2"]'); if (m) m.setAttribute('aria-label', 'Switch light or dark mode');
    const nav = document.querySelector('.nav'); if (nav) nav.setAttribute('aria-label', 'Main menu');
    const main = document.querySelector('.main'); if (main) main.setAttribute('role', 'main');
    if (r.startsWith('post-')) decoratePost();
    const wrap = document.querySelector('.main .wrap');
    if (wrap && !wrap.querySelector('.site-foot')) wrap.append(footer());
  }
  const origRender = window.render;
  window.render = function () { origRender.apply(this, arguments); enhance(); };

  // ---- landing page for visitors who are not signed in ----
  let featured = null;
  const FEATS = [['✍️', 'Rich editor', 'Format text, add images and links, and preview before you publish.'],
    ['🗂️', 'Drafts and categories', 'Save drafts, organise blogs by category, and search them.'],
    ['🔒', 'Secure accounts', 'Passwords are hashed and logins use protected JWT cookies.'],
    ['📱', 'Works everywhere', 'Responsive on phone, tablet and desktop, with dark mode.']];
  function featuredHtml() {
    if (!featured) return '<div class="grid"><div class="sk"></div><div class="sk"></div><div class="sk"></div></div>';
    if (!featured.length) return '';
    return '<div class="grid">' + featured.map(b => '<div class="card land-card"><div class="im" style="' + cov(b) + '">' + (b.cover ? '' : (EM[b.category] || '✍')) + '</div><div class="bd"><span class="chip">' + esc(b.category) + '</span><h3>' + esc(b.title) + '</h3><div class="mu">' + esc(b.desc) + '</div><div class="mu" style="margin-top:8px">' + esc(b.author.name) + ' · ♥ ' + b.likes + ' · 👁 ' + b.views + '</div></div></div>').join('') + '</div>';
  }
  function buildLanding() {
    document.title = 'Inkwell – Write. Share. Inspire.';
    const root = el('root'), wrap = root.querySelector(':scope > .wrap');
    if (!wrap || root.querySelector('.land-hero')) return;
    const hero = document.createElement('section'), left = document.createElement('div'), right = document.createElement('div');
    hero.className = 'land-hero';
    left.innerHTML = '<span class="chip">✒ Inkwell</span><h1>Write. Share. Inspire.</h1>' +
      '<p class="mu" style="font-size:16px">A simple home for your stories. Write rich blogs, save drafts, explore categories and connect with readers.</p>' +
      '<p class="mu">Sign in or create a free account to start.</p>';
    right.append(wrap);
    hero.append(left, right);
    root.prepend(hero);
    const feats = document.createElement('section');
    feats.className = 'land-sec';
    feats.innerHTML = '<div class="land-feats">' + FEATS.map(f => '<div class="box"><div class="ico">' + f[0] + '</div><b>' + f[1] + '</b><div class="mu">' + f[2] + '</div></div>').join('') + '</div>';
    root.append(feats);
    const sec = document.createElement('section');
    sec.className = 'land-sec';
    sec.innerHTML = '<h2>Latest from the community</h2><div id="land-feat">' + featuredHtml() + '</div>';
    root.append(sec);
    root.append(footer());
    if (!featured) {
      window.api.get('/blogs?limit=3').then(r => { featured = r.blogs; }).catch(() => { featured = []; })
        .then(() => { const box = el('land-feat'); if (box) box.innerHTML = featuredHtml(); });
    }
  }
  const origShowAuth = window.showAuth;
  window.showAuth = function () { origShowAuth.apply(this, arguments); buildLanding(); };
  document.addEventListener('click', e => {
    if (e.target.closest('.land-card')) { toast('Sign in or create an account to read this blog'); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  });

  // ---- delete confirmation popup ----
  let allow = false;
  const origConfirm = window.confirm.bind(window);
  window.confirm = m => (allow ? true : origConfirm(m));
  function modal(title, text, okLabel, onOk) {
    const bd = document.createElement('div');
    bd.className = 'modal-bd';
    bd.setAttribute('role', 'dialog');
    bd.setAttribute('aria-modal', 'true');
    bd.innerHTML = '<div class="modal"><h3>' + esc(title) + '</h3><p class="mu" style="font-size:14px">' + esc(text) + '</p>' +
      '<div class="row" style="justify-content:flex-end;margin-top:14px"><button class="b g" data-m="no">Cancel</button><button class="b d" data-m="yes">' + esc(okLabel) + '</button></div></div>';
    const onKey = e => { if (e.key === 'Escape') close(); };
    const close = () => { bd.remove(); document.removeEventListener('keydown', onKey); };
    bd.addEventListener('click', e => {
      const b = e.target.closest('[data-m]');
      if (e.target === bd || (b && b.dataset.m === 'no')) close();
      else if (b) { close(); onOk(); }
    });
    document.addEventListener('keydown', onKey);
    document.body.append(bd);
    bd.querySelector('[data-m="no"]').focus();
  }
  document.addEventListener('click', e => {
    const t = e.target.closest('[data-a="del"]');
    if (!t || allow) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    modal('Delete this blog?', 'This cannot be undone. Its comments and likes will be removed too.', 'Delete', () => {
      allow = true;
      try { t.click(); } finally { allow = false; }
    });
  }, true);

  // ---- toasts: red accent for errors, announced to screen readers ----
  const toastBox = el('toast');
  if (toastBox) {
    toastBox.setAttribute('aria-live', 'polite');
    new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(n => {
      if (n.nodeType === 1 && /fail|invalid|error|wrong|cannot|too many|not set|expired|do not match|went wrong/i.test(n.textContent)) n.classList.add('err');
    }))).observe(toastBox, { childList: true });
  }

  // ---- "waking up the server" note for the free host ----
  let since = 0;
  setInterval(() => {
    if (!document.querySelector('#root .sk')) { since = 0; return; }
    if (!since) since = Date.now();
    if (Date.now() - since > 5000 && !el('wake')) {
      const n = document.createElement('p');
      n.id = 'wake';
      n.className = 'mu';
      n.style.textAlign = 'center';
      n.textContent = 'Waking up the server… the free host can take up to a minute. Thanks for waiting!';
      el('root').append(n);
    }
  }, 1000);
})();
