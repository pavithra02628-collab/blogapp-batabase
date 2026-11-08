/* Inkwell: Express backend with MongoDB. Serves index.html and the REST API.
   Needs package.json for dependencies. Start with: npm start */
const MODS = {};
const R = n => MODS[n] || require(n);
const SEED = {"profiles/inkwell":{"createdAt":1762300000000,"fullName":"Inkwell Team"},"posts/seed-welcome":{"author":"inkwell","category":"Education","content":"<p>Inkwell is a place to <b>write</b>, <i>read</i> and talk about ideas.</p><h2>Getting started</h2><ul><li>Open <b>Create Blog</b> and write your first story.</li><li>Save it as a draft, or publish when you are ready.</li><li>Like, comment and bookmark posts you enjoy.</li></ul><p>Happy writing!</p>","cover":"","createdAt":1762300000000,"desc":"A quick tour of what you can do here, from drafts to sharing.","status":"published","tags":["welcome","guide"],"title":"Welcome to Inkwell: Start Writing Today","updatedAt":1762300000000},"posts/seed-react":{"author":"inkwell","category":"Technology","content":"<p>Performance is mostly about <b>doing less work</b>.</p><ol><li>Keep state close to where it is used.</li><li>Memoize only after you measure.</li><li>Split large screens into lazy-loaded chunks.</li><li>Use stable keys in lists.</li><li>Debounce anything tied to typing.</li></ol><p>Measure first, then optimize what actually hurts.</p>","cover":"","createdAt":1762200000000,"desc":"Small decisions that keep your interface snappy as it grows.","status":"published","tags":["react","performance"],"title":"Five React Habits That Keep Apps Fast","updatedAt":1762200000000},"posts/seed-travel":{"author":"inkwell","category":"Travel","content":"<p>A weekend away does not need a big suitcase. Pick <b>three outfits</b> that mix and match, one warm layer, and shoes you can walk in all day.</p><p>Leave room for souvenirs and for the things you did not plan to bring home.</p>","cover":"","createdAt":1762100000000,"desc":"How to enjoy a short trip with just one small bag.","status":"published","tags":["travel","packing"],"title":"A Weekend in the Hills: Packing Light","updatedAt":1762100000000},"posts/seed-food":{"author":"inkwell","category":"Food","content":"<p>Boil noodles, then toss them with a spoon of chilli oil, soy sauce and a squeeze of lime.</p><p>Top with a <i>jammy egg</i>, spring onions and any leftover vegetables. Dinner is done before the dishes pile up.</p>","cover":"","createdAt":1762000000000,"desc":"Fast, flexible and made from things already in your kitchen.","status":"published","tags":["recipe","quick"],"title":"The 15-Minute Weeknight Noodle Bowl","updatedAt":1762000000000},"posts/seed-focus":{"author":"inkwell","category":"Lifestyle","content":"<p>Before you open messages, spend <b>90 minutes</b> on the one task that matters most.</p><blockquote>What you do first sets the tone for the whole day.</blockquote><p>Keep your phone in another room and write down the next step before you stop.</p>","cover":"","createdAt":1761900000000,"desc":"Protect your first two hours and watch your output change.","status":"published","tags":["focus","habits"],"title":"Deep Work: A Simple Morning Routine","updatedAt":1761900000000},"posts/seed-startup":{"author":"inkwell","category":"Business","content":"<p>Most founders price from fear. Customers read price as a signal of <b>quality and seriousness</b>.</p><p>Talk to ten buyers, test a higher number, and let real conversations, not guesses, set your price.</p>","cover":"","createdAt":1761800000000,"desc":"Why charging too little can hurt more than charging too much.","status":"published","tags":["startup","pricing"],"title":"What Early-Stage Startups Get Wrong About Pricing","updatedAt":1761800000000},"likes/seed-react_a1":{"post":"seed-react","user":"a1"},"likes/seed-react_a2":{"post":"seed-react","user":"a2"},"likes/seed-react_a3":{"post":"seed-react","user":"a3"},"likes/seed-food_a1":{"post":"seed-food","user":"a1"},"likes/seed-welcome_a2":{"post":"seed-welcome","user":"a2"},"views/seed-react_a1":{"post":"seed-react","user":"a1"},"views/seed-react_a2":{"post":"seed-react","user":"a2"},"views/seed-react_a3":{"post":"seed-react","user":"a3"},"views/seed-react_a4":{"post":"seed-react","user":"a4"},"views/seed-food_a1":{"post":"seed-food","user":"a1"},"views/seed-food_a2":{"post":"seed-food","user":"a2"},"views/seed-welcome_a1":{"post":"seed-welcome","user":"a1"},"comments/seed-c1":{"createdAt":1762250000000,"post":"seed-react","text":"Which of these habits helped you most? Tell us below.","user":"inkwell"}};
const PAGE = require('fs').readFileSync(require('path').join(__dirname, 'index.html'), 'utf8');
MODS.config=(()=>{const module={exports:{}};const exports=module.exports;
const crypto = R('crypto');
const PROD = process.env.NODE_ENV === 'production';
let SECRET = process.env.JWT_SECRET;
if (!SECRET) {
  if (PROD) { console.error('JWT_SECRET is required in production'); process.exit(1); }
  SECRET = crypto.randomBytes(32).toString('hex');
  console.warn('JWT_SECRET not set: using a temporary secret (logins reset when the server restarts)');
}
module.exports = {
  PROD, SECRET, PORT: process.env.PORT || 3000,
  // HTTP-only cookie. SameSite=None + Secure in production so a separately hosted frontend can use it.
  cookieOpts: { httpOnly: true, sameSite: PROD ? 'none' : 'lax', secure: PROD, path: '/' }
};

return module.exports})();
MODS.store=(()=>{const module={exports:{}};const exports=module.exports;
// MongoDB storage (Mongoose connection). Each kind of data lives in its own collection:
// accounts (hashed credentials), emails, profiles, posts, likes, views, comments, misc.
const mongoose = R('mongoose');
const COLS = ['accounts', 'emails', 'profiles', 'posts', 'likes', 'views', 'comments'];
let mem = {}, db = null;
const target = p => { const i = p.indexOf('/'), c = p.slice(0, i), id = p.slice(i + 1); return COLS.includes(c) && !id.includes('/') ? { col: c, id } : { col: 'misc', id: p }; };
const logErr = e => console.error('MongoDB error:', e.message);
async function init() {
  const uri = process.env.MONGODB_URI;
  if (!uri) { console.warn('MONGODB_URI is not set: data is kept in memory and is lost on restart'); mem = JSON.parse(JSON.stringify(SEED)); return; }
  await mongoose.connect(uri);
  db = mongoose.connection.db;
  console.log('Connected to MongoDB');
  for (const col of [...COLS, 'misc']) {
    for (const d of await db.collection(col).find({}).toArray()) {
      const { _id, ...data } = d;
      mem[col === 'misc' ? _id : col + '/' + _id] = data;
    }
  }
  if (!Object.keys(mem).length) {
    for (const p of Object.keys(SEED)) set(p, JSON.parse(JSON.stringify(SEED[p])));
    console.log('Sample blogs added to the database');
  }
}
function set(p, d) {
  mem[p] = d;
  if (db) { const t = target(p); db.collection(t.col).replaceOne({ _id: t.id }, { ...d }, { upsert: true }).catch(logErr); }
}
function del(p) {
  delete mem[p];
  if (db) { const t = target(p); db.collection(t.col).deleteOne({ _id: t.id }).catch(logErr); }
}
module.exports = {
  init, set, del,
  has: p => p in mem,
  get: p => mem[p],
  list: c => Object.keys(mem).filter(k => k.startsWith(c + '/') && !k.slice(c.length + 1).includes('/')).map(k => ({ id: k.slice(c.length + 1), data: mem[k] })),
  purgePost: id => { Object.keys(mem).forEach(k => { if (/^(likes|views|comments)\//.test(k) && mem[k].post === id) del(k); }); }
};

return module.exports})();
MODS.mw=(()=>{const module={exports:{}};const exports=module.exports;
const jwt = R('jsonwebtoken');
const { SECRET } = R('config');
exports.requireAuth = (req, res, next) => {
  try { req.uid = jwt.verify(req.cookies.token, SECRET).uid; next(); }
  catch (e) { res.status(401).json({ error: 'Please sign in' }); }
};

return module.exports})();
MODS.authRoutes=(()=>{const module={exports:{}};const exports=module.exports;
const router = R('express').Router();
const bcrypt = R('bcryptjs'), jwt = R('jsonwebtoken'), rateLimit = R('express-rate-limit');
const store = R('store'), { SECRET, cookieOpts } = R('config'), { requireAuth } = R('mw');

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30, message: { error: 'Too many attempts. Try again in a few minutes.' } });
const bad = (res, msg, code = 400) => res.status(code).json({ error: msg });
const pub = u => ({ id: u, fullName: store.get('profiles/' + u).fullName });
function login(res, uid, remember) {
  const days = remember ? 30 : 1;
  const token = jwt.sign({ uid }, SECRET, { expiresIn: days + 'd' });
  res.cookie('token', token, remember ? { ...cookieOpts, maxAge: days * 864e5 } : cookieOpts);
}

// POST /api/auth/signup
router.post('/signup', limiter, async (req, res, next) => {
  try {
    const b = req.body || {};
    const fn = String(b.fullName || '').trim(), em = String(b.email || '').trim().toLowerCase(), un = String(b.username || '').trim().toLowerCase(), pw = String(b.password || '');
    if (fn.length < 2 || fn.length > 60) return bad(res, 'Enter your full name');
    if (!/^[a-z0-9_.+\-]+@[a-z0-9.\-]+\.[a-z]{2,}$/.test(em)) return bad(res, 'Enter a valid email');
    if (!/^[a-z0-9_]{3,20}$/.test(un)) return bad(res, 'Username: 3–20 letters, numbers or underscores');
    if (pw.length < 8 || pw.length > 100) return bad(res, 'Password needs 8+ characters');
    if (store.has('accounts/' + un)) return bad(res, 'Username already taken', 409);
    if (store.has('emails/' + em)) return bad(res, 'Email already registered', 409);
    const hash = await bcrypt.hash(pw, 10);
    store.set('accounts/' + un, { hash, email: em });
    store.set('emails/' + em, { un });
    store.set('profiles/' + un, { fullName: fn, createdAt: Date.now() });
    login(res, un, true);
    res.status(201).json({ user: pub(un) });
  } catch (e) { next(e); }
});

// POST /api/auth/signin  (email or username)
router.post('/signin', limiter, async (req, res, next) => {
  try {
    const b = req.body || {};
    let id = String(b.identifier || '').trim().toLowerCase();
    if (id.includes('@')) id = (store.get('emails/' + id) || {}).un || '';
    const acc = id && store.get('accounts/' + id);
    const ok = acc && await bcrypt.compare(String(b.password || ''), acc.hash);
    if (!ok) return bad(res, 'Invalid credentials', 401);
    login(res, id, !!b.remember);
    res.json({ user: pub(id) });
  } catch (e) { next(e); }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => { res.clearCookie('token', cookieOpts); res.json({ message: 'Logged out' }); });

// GET /api/auth/me
router.get('/me', requireAuth, (req, res) => {
  if (!store.get('profiles/' + req.uid)) return bad(res, 'Account not found', 401);
  res.json({ user: pub(req.uid) });
});

// PUT /api/auth/password
router.put('/password', requireAuth, async (req, res, next) => {
  try {
    const { current = '', next: np = '' } = req.body || {};
    const acc = store.get('accounts/' + req.uid);
    if (!acc || !(await bcrypt.compare(String(current), acc.hash))) return bad(res, 'Current password is wrong', 401);
    if (String(np).length < 8 || String(np).length > 100) return bad(res, 'New password needs 8+ characters');
    store.set('accounts/' + req.uid, { ...acc, hash: await bcrypt.hash(String(np), 10) });
    res.json({ message: 'Password changed' });
  } catch (e) { next(e); }
});
module.exports = router;

return module.exports})();
MODS.dataRoutes=(()=>{const module={exports:{}};const exports=module.exports;
// Authorised document API used by the blog: posts, likes, views, comments, profiles, bookmarks.
const router = R('express').Router();
const sanitizeHtml = R('sanitize-html');
const store = R('store'), { requireAuth } = R('mw');
router.use(requireAuth);

const OK = /^[A-Za-z0-9_\-.~:@+\/]{1,200}$/;
const split = p => { const i = p.lastIndexOf('/'); return [p.slice(0, i), p.slice(i + 1)]; };
const cleanHtml = h => sanitizeHtml(String(h || ''), {
  allowedTags: ['p','br','b','strong','i','em','u','h1','h2','h3','ul','ol','li','a','img','blockquote','span','div','font','pre','code'],
  allowedAttributes: { a: ['href', 'target', 'rel'], img: ['src', 'alt'], font: ['size', 'face'], '*': ['style'] },
  allowedSchemes: ['http', 'https', 'mailto'], allowedSchemesByTag: { img: ['http', 'https', 'data'] },
  allowedStyles: { '*': { 'text-align': [/^(left|right|center|justify)$/], 'font-size': [/^[\d.]+(px|em|rem|%)$/], 'font-family': [/^[\w\s,'"-]+$/] } },
  transformTags: { a: sanitizeHtml.simpleTransform('a', { target: '_blank', rel: 'noopener noreferrer' }) }
});

function visible(p, d, uid) {
  if (/^(accounts|emails)\//.test(p)) return false;
  if (p.startsWith('data/users/') && !p.startsWith('data/users/' + uid + '/')) return false;
  if (p.startsWith('posts/') && d.status !== 'published' && d.author !== uid) return false;
  return true;
}
const E = (error, status = 400) => ({ error, status });

function build(col, id, body, old, uid) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return E('Invalid body');
  if (col === 'posts') {
    if (old && old.author !== uid) return E('This is not your post', 403);
    const title = String(body.title || '').trim();
    if (title.length < 3 || title.length > 150) return E('Title must be 3–150 characters');
    if (!['draft', 'published'].includes(body.status)) return E('Invalid status');
    const cover = String(body.cover || '');
    if (cover.length > 400000 || (cover && !/^(data:image\/|https?:)/.test(cover))) return E('Invalid cover image');
    const tags = (Array.isArray(body.tags) ? body.tags : []).slice(0, 8).map(t => String(t).trim().slice(0, 30)).filter(Boolean);
    return { data: { title, desc: String(body.desc || '').trim().slice(0, 300), content: cleanHtml(body.content), cover,
      category: String(body.category || 'Technology').slice(0, 40), tags, status: body.status, author: uid,
      createdAt: old ? old.createdAt : Date.now(), updatedAt: Date.now() } };
  }
  if (col === 'likes' || col === 'views') {
    const post = String(body.post || '');
    if (id !== post + '_' + uid || !store.has('posts/' + post)) return E('Forbidden', 403);
    return { data: { post, user: uid } };
  }
  if (col === 'comments') {
    if (old) return E('Comments cannot be edited', 403);
    const text = String(body.text || '').trim(), post = String(body.post || '');
    if (!text || text.length > 1000) return E('Comment must be 1–1000 characters');
    if (!store.has('posts/' + post)) return E('Post not found', 404);
    return { data: { post, user: uid, text, createdAt: Date.now() } };
  }
  if (col === 'profiles') {
    if (id !== uid || !old) return E('Forbidden', 403);
    const fullName = String(body.fullName || '').trim().slice(0, 60);
    if (fullName.length < 2) return E('Enter your full name');
    return { data: { ...old, fullName } };
  }
  if (col.startsWith('data/users/' + uid + '/')) {
    if (JSON.stringify(body).length > 5000) return E('Too large');
    return { data: body };
  }
  return E('Forbidden', 403);
}
function pathOf(req, res) {
  const p = String(req.query.path || '');
  if (!OK.test(p) || p.includes('..') || p.startsWith('/') || p.endsWith('/')) { res.status(400).json({ error: 'Bad path' }); return null; }
  return p;
}
router.get('/collection', (req, res) => {
  const c = pathOf(req, res); if (!c) return;
  res.json({ docs: store.list(c).filter(d => visible(c + '/' + d.id, d.data, req.uid)) });
});
router.get('/doc', (req, res) => {
  const p = pathOf(req, res); if (!p) return;
  const d = store.get(p);
  if (d === undefined || !visible(p, d, req.uid)) return res.status(404).json({ error: 'Not found' });
  res.json({ data: d });
});
function write(req, res, merge) {
  const p = pathOf(req, res); if (!p) return;
  const [col, id] = split(p), old = store.get(p);
  if (merge && !old) return res.status(404).json({ error: 'Not found' });
  const r = build(col, id, merge ? { ...old, ...req.body } : req.body, old, req.uid);
  if (r.error) return res.status(r.status).json({ error: r.error });
  store.set(p, r.data);
  res.json({ data: r.data });
}
router.put('/doc', (req, res) => write(req, res, false));
router.patch('/doc', (req, res) => write(req, res, true));
router.delete('/doc', (req, res) => {
  const p = pathOf(req, res); if (!p) return;
  const [col, id] = split(p), old = store.get(p);
  if (!old) return res.json({ deleted: false });
  let ok = false;
  if (col === 'posts') ok = old.author === req.uid;
  else if (col === 'likes' || col === 'views') ok = id.endsWith('_' + req.uid);
  else if (col === 'comments') ok = old.user === req.uid || (store.get('posts/' + old.post) || {}).author === req.uid;
  else ok = col.startsWith('data/users/' + req.uid + '/');
  if (!ok) return res.status(403).json({ error: 'Forbidden' });
  store.del(p);
  if (col === 'posts') store.purgePost(id);
  res.json({ deleted: true });
});
module.exports = router;

return module.exports})();
MODS.blogRoutes=(()=>{const module={exports:{}};const exports=module.exports;
// Public read-only API: GET /api/blogs (all published blogs) and GET /api/blogs/:id (one blog)
const router = R('express').Router();
const store = R('store');
const count = (col, id) => store.list(col).filter(d => d.data.post === id).length;
const shape = (id, p, full) => ({
  id, title: p.title, desc: p.desc, category: p.category, tags: p.tags, cover: p.cover,
  author: { id: p.author, name: (store.get('profiles/' + p.author) || {}).fullName || 'Unknown' },
  createdAt: p.createdAt, updatedAt: p.updatedAt,
  likes: count('likes', id), views: count('views', id), comments: count('comments', id),
  ...(full ? { content: p.content } : {})
});
router.get('/', (req, res) => {
  const q = String(req.query.search || '').toLowerCase(), cat = req.query.category;
  const list = store.list('posts')
    .filter(d => d.data.status === 'published' && (!cat || d.data.category === cat) && (!q || (d.data.title + ' ' + d.data.desc).toLowerCase().includes(q)))
    .sort((a, b) => b.data.createdAt - a.data.createdAt);
  const page = Math.max(1, +req.query.page || 1), limit = Math.min(50, Math.max(1, +req.query.limit || 10));
  res.json({ total: list.length, page, limit, blogs: list.slice((page - 1) * limit, page * limit).map(d => shape(d.id, d.data)) });
});
router.get('/:id', (req, res) => {
  const p = store.get('posts/' + req.params.id);
  if (!p || p.status !== 'published') return res.status(404).json({ error: 'Blog not found' });
  res.json({ blog: shape(req.params.id, p, true) });
});
module.exports = router;

return module.exports})();

try{require('dotenv').config()}catch(e){}
const express = require('express'), helmet = require('helmet'), cors = require('cors'), cookieParser = require('cookie-parser'), rateLimit = require('express-rate-limit'), path = require('path');
const { PORT } = MODS.config;
const app = express();
app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'cross-origin' } }));
const allowed = (process.env.CLIENT_ORIGIN || '').split(',').map(s => s.trim()).filter(Boolean);
app.use(cors({ origin: (o, cb) => cb(null, !o || allowed.includes(o) || /^http:\/\/localhost:\d+$/.test(o)), credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.get('/api/health', (req, res) => res.json({ ok: true }));
app.use('/api/auth', MODS.authRoutes);
app.use('/api/blogs', MODS.blogRoutes);
app.use('/api/data', rateLimit({ windowMs: 60 * 1000, max: 600 }), MODS.dataRoutes);
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));
app.get('/', (req, res) => res.type('html').send(PAGE));
app.use((req, res) => res.redirect('/'));
app.use((err, req, res, next) => {
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Request too large' });
  console.error(err);
  res.status(500).json({ error: 'Server error' });
});
MODS.store.init()
  .then(() => app.listen(PORT, () => console.log('Inkwell running on http://localhost:' + PORT)))
  .catch(e => { console.error('Startup failed:', e.message); process.exit(1); });
