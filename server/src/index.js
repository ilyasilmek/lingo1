// Lingo skor tablosu sunucusu (Cloudflare Worker + D1).
// Yalnızca Günün Kelimesi skorlarını kabul eder ve puanı kendisi hesaplar.
import answersText from '../../data/answers-5.txt';
import validText from '../../data/valid-5.txt';
import { cleanName } from '../../js/game.js';
import {
  PERIODS, checkDailySubmission, periodStart, publicNameProblem, isPlayerId, isSecret,
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

// Oyuncuyu doğrular; yoksa ve create true ise oluşturur.
async function authPlayer(env, { id, secret, name }, { create = false } = {}) {
  if (!isPlayerId(id) || !isSecret(secret)) return { error: 'Geçersiz oyuncu kimliği', status: 401 };
  const hash = await sha256(secret);
  const row = await env.DB.prepare('SELECT id, secret_hash, name, hidden FROM players WHERE id = ?').bind(id).first();
  if (row) {
    if (row.secret_hash !== hash) return { error: 'Oyuncu doğrulanamadı', status: 401 };
    return { player: row };
  }
  if (!create) return { error: 'Oyuncu bulunamadı', status: 404 };
  const problem = publicNameProblem(name);
  if (problem) return { error: problem, status: 400 };
  await env.DB.prepare('INSERT INTO players (id, secret_hash, name) VALUES (?, ?, ?)').bind(id, hash, cleanName(name)).run();
  return { player: { id, name: cleanName(name), hidden: 0 }, created: true };
}

// POST /v1/oyuncu  { id, secret, name } -> oyuncuyu kaydeder ya da adını günceller
async function upsertPlayer(request, env) {
  const body = await readJson(request);
  if (!body) return fail('Geçersiz istek');
  const auth = await authPlayer(env, body, { create: true });
  if (auth.error) return fail(auth.error, auth.status);
  if (!auth.created && body.name !== undefined && cleanName(body.name) !== auth.player.name) {
    const problem = publicNameProblem(body.name);
    if (problem) return fail(problem);
    await env.DB.prepare("UPDATE players SET name = ?, updated_at = datetime('now') WHERE id = ?").bind(cleanName(body.name), body.id).run();
  }
  return json({ ok: true });
}

// POST /v1/skor  { id, secret, name, day, guesses, hints, seconds }
async function submitScore(request, env) {
  const body = await readJson(request);
  if (!body) return fail('Geçersiz istek');
  const auth = await authPlayer(env, body, { create: true });
  if (auth.error) return fail(auth.error, auth.status);
  const check = checkDailySubmission(
    { day: body.day, guesses: body.guesses, hints: body.hints ?? 0, seconds: Number(body.seconds) },
    { answers: ANSWERS, valid: VALID, today: istanbulToday() },
  );
  if (!check.ok) return fail(check.error, 422);
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

// POST /v1/gizle  { id }  (Authorization: Bearer ADMIN_KEY) -> uygunsuz adı listeden gizler
async function hidePlayer(request, env) {
  const auth = request.headers.get('authorization') || '';
  if (!env.ADMIN_KEY || auth !== `Bearer ${env.ADMIN_KEY}`) return fail('Yetkisiz', 401);
  const body = await readJson(request);
  if (!body || !isPlayerId(body.id)) return fail('Geçersiz istek');
  const hidden = body.hidden === false ? 0 : 1;
  const res = await env.DB.prepare('UPDATE players SET hidden = ? WHERE id = ?').bind(hidden, body.id).run();
  return json({ ok: true, changed: res.meta?.changes ?? 0 });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    try {
      if (url.pathname === '/v1/tablo' && request.method === 'GET') return await leaderboard(url, env);
      if (url.pathname === '/v1/skor' && request.method === 'POST') return await submitScore(request, env);
      if (url.pathname === '/v1/oyuncu' && request.method === 'POST') return await upsertPlayer(request, env);
      if (url.pathname === '/v1/gizle' && request.method === 'POST') return await hidePlayer(request, env);
      if (url.pathname === '/') return json({ ok: true, service: 'lingo-skor', today: istanbulToday() });
      return fail('Bulunamadı', 404);
    } catch (e) {
      console.error(e);
      return fail('Sunucu hatası', 500);
    }
  },
};
