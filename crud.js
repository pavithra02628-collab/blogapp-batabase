// Module 4: Blog CRUD API (create, update, delete, my blogs) with owner-only access.
// Reading all blogs / one blog (with search and category filter) is GET /api/blogs and GET /api/blogs/:id.
const express = require('express');
const sanitizeHtml = require('sanitize-html');

module.exports = function (MODS) {
  const router = express.Router();
  const store = MODS.store, requireAuth = MODS.mw.requireAuth;

  const clean = h => sanitizeHtml(String(h || ''), {
    allowedTags: ['p','br','b','strong','i','em','u','h1','h2','h3','ul','ol','li','a','img','blockquote','span','div','font','pre','code'],
    allowedAttributes: { a: ['href', 'target', 'rel'], img: ['src', 'alt'], font: ['size', 'face'], '*': ['style'] },
    allowedSchemes: ['http', 'https', 'mailto'], allowedSchemesByTag: { img: ['http', 'https', 'data'] },
    allowedStyles: { '*': { 'text-align': [/^(left|right|center|justify)$/], 'font-size': [/^[\d.]+(px|em|rem|%)$/], 'font-family': [/^[\w\s,'"-]+$/] } }
  });

  function fields(b, uid, old) {
    b = b || {};
    const title = String(b.title || '').trim();
    if (title.length < 3 || title.length > 150) return { error: 'Title must be 3–150 characters' };
    if (!['draft', 'published'].includes(b.status)) return { error: 'Status must be draft or published' };
    const content = clean(b.content);
    if (b.status === 'published' && content.replace(/<[^>]*>/g, '').trim().length < 10) return { error: 'Write some content before publishing' };
    const cover = String(b.cover || '');
    if (cover.length > 400000 || (cover && !/^(data:image\/|https?:)/.test(cover))) return { error: 'Invalid cover image' };
    const tags = (Array.isArray(b.tags) ? b.tags : []).slice(0, 8).map(t => String(t).trim().slice(0, 30)).filter(Boolean);
    return { data: {
      title, desc: String(b.desc || '').trim().slice(0, 300), content, cover,
      category: String(b.category || 'Technology').slice(0, 40), tags, status: b.status, author: uid,
      createdAt: old ? old.createdAt : Date.now(), updatedAt: Date.now()
    } };
  }
  const fail = (res, code, msg) => res.status(code).json({ error: msg });

  // READ my blogs (drafts and published)  GET /api/blogs/mine
  router.get('/mine', requireAuth, (req, res) => {
    const list = store.list('posts').filter(d => d.data.author === req.uid)
      .sort((a, b) => b.data.updatedAt - a.data.updatedAt).map(d => ({ id: d.id, ...d.data }));
    res.json({ total: list.length, blogs: list });
  });

  // CREATE  POST /api/blogs
  router.post('/', requireAuth, (req, res) => {
    const r = fields(req.body, req.uid, null);
    if (r.error) return fail(res, 400, r.error);
    const id = 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    store.set('posts/' + id, r.data);
    res.status(201).json({ blog: { id, ...r.data } });
  });

  // UPDATE (owner only)  PUT /api/blogs/:id
  router.put('/:id', requireAuth, (req, res) => {
    const old = store.get('posts/' + req.params.id);
    if (!old) return fail(res, 404, 'Blog not found');
    if (old.author !== req.uid) return fail(res, 403, 'You can only edit your own blogs');
    const r = fields(req.body, req.uid, old);
    if (r.error) return fail(res, 400, r.error);
    store.set('posts/' + req.params.id, r.data);
    res.json({ blog: { id: req.params.id, ...r.data } });
  });

  // DELETE (owner only)  DELETE /api/blogs/:id
  router.delete('/:id', requireAuth, (req, res) => {
    const old = store.get('posts/' + req.params.id);
    if (!old) return fail(res, 404, 'Blog not found');
    if (old.author !== req.uid) return fail(res, 403, 'You can only delete your own blogs');
    store.del('posts/' + req.params.id);
    store.purgePost(req.params.id);
    res.json({ message: 'Blog deleted' });
  });

  return router;
};
