// Lingo skor tablosu sunucusu (Cloudflare Worker + D1).
// Yalnızca Günün Kelimesi skorlarını kabul eder ve puanı kendisi hesaplar.
import answersText from '../../data/answers-5.txt';
import validText from '../../data/valid-5.txt';
import { cleanName } from '../../js/game.js';
import { ADMIN_HTML } from './admin-page.js';
import {
  PERIODS, checkDailySubmission, periodStart, publicNameProblem, isPlayerId, isSecret, nameKey,
} from '../../js/leaderboard-rules.js';

const ANSWERS = answersText.split('\n').filter(Boolean);
const VALID = new Set(validText.split('\n').filter(Boolean));
const LIMIT = 50;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type, authorization',
  'Access-Control-Max-Age': '86400',
};

const json = (data, status = 200, extra = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...CORS, ...extra },
  });
const fail = (error, status = 400) => json({ error }, status);

// Sunucunun "bugün"ü Türkiye saatine göredir.
export function istanbulToday(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function readJson(request) {
  try {
    const body = await request.json();
    return body && typeof body === 'object' ? body : null;
  } catch {
    return null;
  }
}

const NAME_TAKEN = 'Bu ad başka bir oyuncu tarafından kullanılıyor. Başka bir ad seç.';

// Adın başka bir oyuncuda olup olmadığına bakar (selfId hariç).
async function nameTaken(env, key, selfId) {
  const row = await env.DB.prepare('SELECT id FROM players WHERE name_key = ? AND id != ?').bind(key, selfId).first();
  return !!row;
}

const isUniqueError = (e) => /UNIQUE constraint failed/i.test(String(e?.message || e));

// Oyuncuyu doğrular; yoksa ve create true ise oluşturur.
async function authPlayer(env, { id, secret, name }, { create = false } = {}) {
  if (!isPlayerId(id) || !isSecret(secret)) return { error: 'Geçersiz oyuncu kimliği', status: 401 };
  const hash = await sha256(secret);
  const row = await env.DB.prepare('SELECT id, secret_hash, name, name_key, hidden FROM players WHERE id = ?').bind(id).first();
  if (row) {
    if (row.secret_hash !== hash) return { error: 'Oyuncu doğrulanamadı', status: 401 };
    return { player: row };
  }
  if (!create) return { error: 'Oyuncu bulunamadı', status: 404 };
  const problem = publicNameProblem(name);
  if (problem) return { error: problem, status: 400 };
  const key = nameKey(name);
  if (await nameTaken(env, key, id)) return { error: NAME_TAKEN, status: 409 };
  try {
    await env.DB.prepare('INSERT INTO players (id, secret_hash, name, name_key) VALUES (?, ?, ?, ?)').bind(id, hash, cleanName(name), key).run();
  } catch (e) {
    if (isUniqueError(e)) return { error: NAME_TAKEN, status: 409 };
    throw e;
  }
  return { player: { id, name: cleanName(name), name_key: key, hidden: 0 }, created: true };
}

// POST /v1/oyuncu  { id, secret, name } -> oyuncuyu kaydeder ya da adını günceller.
// Ad başka bir oyuncudaysa 409 döner; ad yalnızca boştaysa alınır.
async function upsertPlayer(request, env) {
  const body = await readJson(request);
  if (!body) return fail('Geçersiz istek');
  const auth = await authPlayer(env, body, { create: true });
  if (auth.error) return fail(auth.error, auth.status);
  if (auth.created || body.name === undefined) return json({ ok: true });
  const p = auth.player;
  const name = cleanName(body.name);
  const key = nameKey(body.name);
  // Ad aynıysa ve anahtarı zaten bu oyuncudaysa yapılacak bir şey yok.
  if (name === p.name && p.name_key === key) return json({ ok: true });
  const problem = publicNameProblem(body.name);
  if (problem) return fail(problem);
  if (await nameTaken(env, key, body.id)) return fail(NAME_TAKEN, 409);
  try {
    // Aynı ad çakışması yüzünden gizlenen oyuncu, boş bir ad alınca yeniden görünür.
    await env.DB.prepare(`UPDATE players SET name = ?, name_key = ?, hidden = CASE WHEN name_key IS NULL THEN 0 ELSE hidden END,
      updated_at = datetime('now') WHERE id = ?`).bind(name, key, body.id).run();
  } catch (e) {
    if (isUniqueError(e)) return fail(NAME_TAKEN, 409);
    throw e;
  }
  return json({ ok: true });
}

// POST /v1/skor  { id, secret, name, day, guesses, hints, seconds }
async function submitScore(request, env) {
  const body = await readJson(request);
  if (!body) return fail('Geçersiz istek');
  if (!isPlayerId(body.id) || !isSecret(body.secret)) return fail('Geçersiz oyuncu kimliği', 401);
  // Önce skor doğrulanır; geçersiz gönderim veritabanında oyuncu kaydı bile açmaz.
  const check = checkDailySubmission(
    { day: body.day, guesses: body.guesses, hints: body.hints ?? 0, seconds: Number(body.seconds) },
    { answers: ANSWERS, valid: VALID, today: istanbulToday() },
  );
  if (!check.ok) return fail(check.error, 422);
  const auth = await authPlayer(env, body, { create: true });
  if (auth.error) return fail(auth.error, auth.status);
  if (!auth.player.name_key) return fail(NAME_TAKEN, 409);
  const res = await env.DB.prepare(
    'INSERT OR IGNORE INTO scores (player_id, day, won, attempts, seconds, hints, points) VALUES (?, ?, ?, ?, ?, ?, ?)',
  ).bind(body.id, body.day, check.won ? 1 : 0, check.attempts, Math.round(body.seconds), body.hints ?? 0, check.points).run();
  const duplicate = (res.meta?.changes ?? 0) === 0;
  if (duplicate) {
    // Bu gün için skor zaten var; ilk gönderilen geçerlidir.
    const prev = await env.DB.prepare('SELECT points FROM scores WHERE player_id = ? AND day = ?').bind(body.id, body.day).first();
    return json({ ok: true, points: prev?.points ?? 0, duplicate: true });
  }
  return json({ ok: true, points: check.points, duplicate: false });
}

const RANKED = `
  WITH t AS (
    SELECT s.player_id, SUM(s.points) AS points, COUNT(*) AS games, SUM(s.won) AS wins, SUM(s.seconds) AS secs
    FROM scores s JOIN players p ON p.id = s.player_id AND p.hidden = 0
    WHERE s.day >= ?1 AND s.day <= ?2
    GROUP BY s.player_id
  ), r AS (
    SELECT *, RANK() OVER (ORDER BY points DESC, secs ASC) AS rank FROM t
  )`;

// GET /v1/tablo?donem=gun|hafta|ay|tum&id=...
async function leaderboard(url, env) {
  const period = url.searchParams.get('donem') || 'gun';
  if (!PERIODS.includes(period)) return fail('Geçersiz dönem');
  const today = istanbulToday();
  const from = periodStart(period, today) || '0000-00-00';
  // 'Bugün' yalnızca bugünü, diğer dönemler başlangıçtan bu yana her şeyi kapsar.
  const until = period === 'gun' ? today : '9999-12-31';
  const { results } = await env.DB.prepare(`${RANKED}
    SELECT r.rank, r.points, r.games, r.wins, r.player_id, p.name FROM r JOIN players p ON p.id = r.player_id
    ORDER BY r.rank, p.name LIMIT ${LIMIT}`).bind(from, until).all();
  const id = url.searchParams.get('id');
  let me = null;
  if (isPlayerId(id)) {
    me = await env.DB.prepare(`${RANKED} SELECT rank, points, games, wins FROM r WHERE player_id = ?3`).bind(from, until, id).first();
  }
  const total = await env.DB.prepare(`${RANKED} SELECT COUNT(*) AS n FROM r`).bind(from, until).first();
  return json({
    period, from: period === 'tum' ? null : from, today, players: total?.n ?? 0,
    entries: results.map((r) => ({ rank: r.rank, name: r.name, points: r.points, games: r.games, wins: r.wins, self: r.player_id === id })),
    me: me ? { rank: me.rank, points: me.points, games: me.games, wins: me.wins } : null,
  }, 200, { 'cache-control': 'no-store' });
}

// ---------- Yönetim ----------

const FAIL_WINDOW = 15 * 60; // saniye
const FAIL_LIMIT = 10;

// Yönetici anahtarını doğrular. Aynı IP'den 15 dakikada 10 yanlış denemeden sonra geçici olarak kilitler.
async function adminAuth(request, env) {
  if (!env.ADMIN_KEY) return { error: 'Yönetici anahtarı sunucuda tanımlı değil', status: 503 };
  const ip = request.headers.get('cf-connecting-ip') || 'yerel';
  const now = Math.floor(Date.now() / 1000);
  const fails = await env.DB.prepare('SELECT COUNT(*) AS n FROM admin_fails WHERE ip = ? AND at > ?').bind(ip, now - FAIL_WINDOW).first();
  if ((fails?.n ?? 0) >= FAIL_LIMIT) return { error: 'Çok fazla yanlış deneme. 15 dakika sonra tekrar dene.', status: 429 };
  const given = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  // Özetler karşılaştırılır; uzunluk ya da ilk harflerden bilgi sızmaz.
  const [a, b] = await Promise.all([sha256(given), sha256(env.ADMIN_KEY)]);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  if (!given || diff !== 0) {
    await env.DB.batch([
      env.DB.prepare('INSERT INTO admin_fails (ip, at) VALUES (?, ?)').bind(ip, now),
      env.DB.prepare('DELETE FROM admin_fails WHERE at < ?').bind(now - 86400),
    ]);
    return { error: 'Anahtar yanlış', status: 401 };
  }
  return { ok: true };
}

function adminPage() {
  return new Response(ADMIN_HTML, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
      'x-frame-options': 'DENY',
      'referrer-policy': 'no-referrer',
      'x-content-type-options': 'nosniff',
      'content-security-policy': "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'",
    },
  });
}

// GET /v1/yonetim/oyuncular?ara=...  -> son kayıt olan ya da adı eşleşen en fazla 100 oyuncu
async function adminPlayers(url, env) {
  const q = (url.searchParams.get('ara') || '').trim().slice(0, 40);
  const where = q ? 'WHERE p.name LIKE ?1' : '';
  const like = `%${q.replace(/[%_]/g, '')}%`;
  const stmt = env.DB.prepare(`
    SELECT p.id, p.name, p.hidden, p.name_key IS NULL AS clash, p.created_at,
      COUNT(s.day) AS games, COALESCE(SUM(s.points), 0) AS points, MAX(s.day) AS last_day
    FROM players p LEFT JOIN scores s ON s.player_id = p.id
    ${where}
    GROUP BY p.id ORDER BY p.created_at DESC LIMIT 100`);
  const { results } = await (q ? stmt.bind(like) : stmt).all();
  const total = await env.DB.prepare('SELECT COUNT(*) AS n FROM players').first();
  return json({ players: results.map((r) => ({ ...r, hidden: !!r.hidden, clash: !!r.clash })), total: total?.n ?? 0 }, 200, { 'cache-control': 'no-store' });
}

// POST /v1/gizle  { id, hidden }  -> oyuncuyu listeden gizler (hidden: false ile geri gösterir)
async function hidePlayer(request, env) {
  const body = await readJson(request);
  if (!body || !isPlayerId(body.id)) return fail('Geçersiz istek');
  const hidden = body.hidden === false ? 0 : 1;
  if (!hidden) {
    const row = await env.DB.prepare('SELECT name_key FROM players WHERE id = ?').bind(body.id).first();
    if (row && !row.name_key) return fail('Bu oyuncunun adı başka bir oyuncuda. Oyuncu yeni bir ad seçince kendiliğinden görünür.', 409);
  }
  const res = await env.DB.prepare("UPDATE players SET hidden = ?, updated_at = datetime('now') WHERE id = ?").bind(hidden, body.id).run();
  return json({ ok: true, changed: res.meta?.changes ?? 0 });
}

async function withAdmin(request, env, handler) {
  const auth = await adminAuth(request, env);
  if (auth.error) return fail(auth.error, auth.status);
  return handler();
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    try {
      if (url.pathname === '/v1/tablo' && request.method === 'GET') return await leaderboard(url, env);
      if (url.pathname === '/v1/skor' && request.method === 'POST') return await submitScore(request, env);
      if (url.pathname === '/v1/oyuncu' && request.method === 'POST') return await upsertPlayer(request, env);
      if (url.pathname === '/yonetim' && request.method === 'GET') return adminPage();
      if (url.pathname === '/v1/yonetim/giris' && request.method === 'GET') return await withAdmin(request, env, () => json({ ok: true }));
      if (url.pathname === '/v1/yonetim/oyuncular' && request.method === 'GET') return await withAdmin(request, env, () => adminPlayers(url, env));
      if (url.pathname === '/v1/gizle' && request.method === 'POST') return await withAdmin(request, env, () => hidePlayer(request, env));
      if (url.pathname === '/') return json({ ok: true, service: 'lingo-skor', today: istanbulToday() });
      return fail('Bulunamadı', 404);
    } catch (e) {
      console.error(e);
      return fail('Sunucu hatası', 500);
    }
  },
};
