// Forgot password with a one-time code (OTP): emails a 6-digit code, then signs the user in.
// Email goes through the Brevo HTTPS API (BREVO_API_KEY + MAIL_FROM). If those are not set,
// the code is written to the server log instead (demo mode).
const crypto = require('crypto'), express = require('express'), bcrypt = require('bcryptjs'), jwt = require('jsonwebtoken'), rateLimit = require('express-rate-limit'), path = require('path');

module.exports = function (MODS) {
  const router = express.Router(), store = MODS.store, { SECRET, cookieOpts } = MODS.config;
  const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, message: { error: 'Too many attempts. Try again later.' } });
  const MINUTES = 15, MAX_TRIES = 5, COOLDOWN_MS = 60 * 1000;
  const hashOtp = (un, otp) => crypto.createHmac('sha256', SECRET).update(un + ':' + otp).digest('hex');
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const cleanEmail = v => String(v || '').trim().toLowerCase();

  async function sendMail(to, subject, html, demoText) {
    const key = process.env.BREVO_API_KEY, from = process.env.MAIL_FROM;
    if (!key || !from) { console.log('[DEMO MODE] Email is not configured. ' + demoText); return false; }
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

  // Frontend script for the forgot-password screens
  router.get('/forgot.js', (req, res) => res.type('js').sendFile(path.join(__dirname, 'forgot.js')));

  // POST /api/auth/forgot-password  { email }  -> emails a 6-digit code
  router.post('/api/auth/forgot-password', limiter, async (req, res, next) => {
    try {
      const em = cleanEmail((req.body || {}).email);
      const reply = { message: 'If that email is registered, a 6-digit code has been sent.' };
      const rec = em && store.get('emails/' + em);
      if (rec && rec.un) {
        const key = 'emails/__otp_' + rec.un, old = store.get(key);
        if (!old || Date.now() - old.sent > COOLDOWN_MS) {
          const otp = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
          store.set(key, { h: hashOtp(rec.un, otp), expires: Date.now() + MINUTES * 60 * 1000, tries: 0, sent: Date.now() });
          const name = (store.get('profiles/' + rec.un) || {}).fullName || 'there';
          await sendMail(em, 'Your Inkwell verification code',
            '<p>Hi ' + esc(name) + ',</p><p>Your Inkwell verification code is:</p>' +
            '<p style="font-size:30px;letter-spacing:6px;font-weight:bold">' + otp + '</p>' +
            '<p>It works for ' + MINUTES + ' minutes. If you did not ask for it, you can ignore this email.</p>',
            'Code for ' + em + ': ' + otp);
        }
      }
      res.json(reply);
    } catch (e) { next(e); }
  });

  // POST /api/auth/verify-otp  { email, otp, password? }  -> checks the code, optionally sets a new password, signs in
  router.post('/api/auth/verify-otp', limiter, async (req, res, next) => {
    try {
      const b = req.body || {}, em = cleanEmail(b.email), otp = String(b.otp || '').replace(/\D/g, ''), pw = String(b.password || '');
      const invalid = () => res.status(400).json({ error: 'Invalid or expired code' });
      const rec0 = em && store.get('emails/' + em), un = rec0 && rec0.un;
      const key = 'emails/__otp_' + un, rec = un && store.get(key);
      if (!un || !rec || rec.expires < Date.now()) { if (rec) store.del(key); return invalid(); }
      if (pw && (pw.length < 8 || pw.length > 100)) return res.status(400).json({ error: 'New password needs 8+ characters' });
      if (rec.tries >= MAX_TRIES) { store.del(key); return invalid(); }
      store.set(key, { ...rec, tries: rec.tries + 1 });
      const a = Buffer.from(hashOtp(un, otp)), c = Buffer.from(rec.h);
      if (a.length !== c.length || !crypto.timingSafeEqual(a, c)) return invalid();
      store.del(key);
      if (pw) {
        const acc = store.get('accounts/' + un);
        if (acc) store.set('accounts/' + un, { ...acc, hash: await bcrypt.hash(pw, 10) });
      }
      const token = jwt.sign({ uid: un }, SECRET, { expiresIn: '30d' });
      res.cookie('token', token, { ...cookieOpts, maxAge: 30 * 864e5 });
      res.json({ user: { id: un, fullName: (store.get('profiles/' + un) || {}).fullName || un } });
    } catch (e) { next(e); }
  });

  return router;
};
