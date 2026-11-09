// Forgot / reset password: emails a one-time link (valid 30 minutes).
// Email is sent through the Brevo HTTPS API (BREVO_API_KEY + MAIL_FROM). If those are not set,
// the reset link is written to the server log instead (demo mode).
const crypto = require('crypto'), express = require('express'), bcrypt = require('bcryptjs'), rateLimit = require('express-rate-limit'), path = require('path');

module.exports = function (MODS) {
  const router = express.Router(), store = MODS.store;
  const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, message: { error: 'Too many attempts. Try again later.' } });
  const sha = t => crypto.createHash('sha256').update(t).digest('hex');
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  async function sendMail(to, subject, html, link) {
    const key = process.env.BREVO_API_KEY, from = process.env.MAIL_FROM;
    if (!key || !from) { console.log('[DEMO MODE] Email is not configured. Reset link for ' + to + ': ' + link); return false; }
    try {
      const r = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'api-key': key, 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ sender: { email: from, name: 'Inkwell' }, to: [{ email: to }], subject, htmlContent: html })
      });
      if (!r.ok) { console.error('Email error', r.status, await r.text()); return false; }
      return true;
    } catch (e) { console.error('Email error:', e.message); return false; }
  }

  // Frontend script for the forgot / reset screens
  router.get('/forgot.js', (req, res) => res.type('js').sendFile(path.join(__dirname, 'forgot.js')));

  // POST /api/auth/forgot-password  { email }
  router.post('/api/auth/forgot-password', limiter, async (req, res, next) => {
    try {
      const em = String((req.body || {}).email || '').trim().toLowerCase();
      const reply = { message: 'If that email is registered, a reset link has been sent.' };
      const rec = store.get('emails/' + em);
      if (em && rec && rec.un) {
        const token = crypto.randomBytes(32).toString('hex');
        store.set('emails/__reset_' + sha(token), { un: rec.un, expires: Date.now() + 30 * 60 * 1000 });
        const base = (process.env.APP_URL || (req.protocol + '://' + req.get('host'))).replace(/\/$/, '');
        const link = base + '/?reset=' + token;
        const name = (store.get('profiles/' + rec.un) || {}).fullName || 'there';
        await sendMail(em, 'Reset your Inkwell password',
          '<p>Hi ' + esc(name) + ',</p><p>Tap the button to choose a new password. The link works for 30 minutes.</p>' +
          '<p><a href="' + link + '" style="background:#2563eb;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Reset password</a></p>' +
          '<p>If you did not ask for this, you can ignore this email.</p>', link);
      }
      res.json(reply);
    } catch (e) { next(e); }
  });

  // POST /api/auth/reset-password  { token, password }
  router.post('/api/auth/reset-password', limiter, async (req, res, next) => {
    try {
      const b = req.body || {}, token = String(b.token || ''), pw = String(b.password || '');
      if (pw.length < 8 || pw.length > 100) return res.status(400).json({ error: 'Password needs 8+ characters' });
      const key = 'emails/__reset_' + sha(token), rec = store.get(key);
      if (!rec || rec.expires < Date.now()) { if (rec) store.del(key); return res.status(400).json({ error: 'This reset link is invalid or has expired' }); }
      const acc = store.get('accounts/' + rec.un);
      if (!acc) { store.del(key); return res.status(400).json({ error: 'Account not found' }); }
      store.set('accounts/' + rec.un, { ...acc, hash: await bcrypt.hash(pw, 10) });
      store.del(key);
      res.json({ message: 'Password updated. You can sign in now.' });
    } catch (e) { next(e); }
  });

  return router;
};
