// api/generate.js
// POST /api/generate → buat key baru, simpan in-memory

// In-memory store (reset tiap cold start Vercel)
// Untuk persistent, ganti dengan Upstash Redis / KV
if (!global.keyStore) global.keyStore = {};

const KEY_DURATION = 24 * 60 * 60 * 1000; // 24 jam ms

function generateKey() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const seg = () => Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `VOLTRIX-${seg()}-${seg()}`;
}

function cleanExpired() {
  const now = Date.now();
  for (const k in global.keyStore) {
    if (global.keyStore[k].expire < now) delete global.keyStore[k];
  }
}

export default function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  cleanExpired();

  // Rate limit sederhana by IP
  const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress || 'unknown';
  
  // Cek apakah IP sudah punya key aktif
  const existing = Object.values(global.keyStore).find(
    (v) => v.ip === ip && v.expire > Date.now()
  );

  if (existing) {
    return res.status(200).json({
      success: true,
      key: existing.key,
      expire: existing.expire,
      cached: true,
    });
  }

  // Buat key baru
  const key    = generateKey();
  const expire = Date.now() + KEY_DURATION;

  global.keyStore[key] = { key, ip, expire };

  return res.status(200).json({
    success: true,
    key,
    expire,
    cached: false,
  });
}
