const crypto = require('crypto');

const HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff'
};

function json(statusCode, body, extraHeaders = {}) {
  return { statusCode, headers: { ...HEADERS, ...extraHeaders }, body: JSON.stringify(body) };
}

function b64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function getSecret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) return null;
  return s;
}

// Token firmado (HMAC-SHA256) sin estado: payload.firma
function signToken(role, ttlSeconds) {
  const secret = getSecret();
  if (!secret) throw new Error('SESSION_SECRET no configurado');
  const payload = b64url(JSON.stringify({ role, exp: Date.now() + ttlSeconds * 1000 }));
  const sig = b64url(crypto.createHmac('sha256', secret).update(payload).digest());
  return `${payload}.${sig}`;
}

function verifyToken(token) {
  const secret = getSecret();
  if (!secret || typeof token !== 'string' || !token.includes('.')) return null;
  const [payload, sig] = token.split('.');
  const expected = b64url(crypto.createHmac('sha256', secret).update(payload).digest());
  if (!safeEqual(sig, expected)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
    if (!data.exp || Date.now() > data.exp) return null;
    return data;
  } catch (e) {
    return null;
  }
}

function getBearer(event) {
  const h = event.headers || {};
  const auth = h.authorization || h.Authorization || '';
  return auth.startsWith('Bearer ') ? auth.slice(7) : '';
}

// Comparación en tiempo constante
function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

function normalize(s) {
  return String(s || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

// Límite de intentos en memoria (mejor esfuerzo; se reinicia con la instancia)
const attempts = new Map();
function rateLimit(event, bucket, max = 5, windowMs = 60_000) {
  const h = event.headers || {};
  const ip = (h['x-nf-client-connection-ip'] || h['x-forwarded-for'] || 'unknown').split(',')[0].trim();
  const key = `${bucket}:${ip}`;
  const now = Date.now();
  const rec = attempts.get(key) || { count: 0, reset: now + windowMs };
  if (now > rec.reset) { rec.count = 0; rec.reset = now + windowMs; }
  rec.count++;
  attempts.set(key, rec);
  if (attempts.size > 500) { for (const [k, v] of attempts) if (now > v.reset) attempts.delete(k); }
  return { limited: rec.count > max, retryAfter: Math.ceil((rec.reset - now) / 1000), key };
}
function clearRate(key) { attempts.delete(key); }

function parseBody(event) {
  try { return JSON.parse(event.body || '{}'); } catch (e) { return {}; }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

module.exports = { json, signToken, verifyToken, getBearer, safeEqual, normalize, rateLimit, clearRate, parseBody, sleep };
