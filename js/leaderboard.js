// Skor tablosu istemcisi. Yalnızca Günün Kelimesi sonuçları, oyuncu izin verdiyse gönderilir.
// İnternet yoksa gönderim sıraya alınır ve uygulama bir sonraki açılışta yeniden dener.
import { LEADERBOARD_URL } from './config.js';
import { getProfile, updateProfile } from './storage.js';

export const leaderboardReady = () => !!LEADERBOARD_URL;

function randomHex(bytes) {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return [...a].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Cihaza özel kimlik ve gizli anahtar; ilk kullanımda üretilir, yalnızca bu cihazda saklanır.
export function identity() {
  const p = getProfile();
  if (p.playerId && p.playerSecret) return { id: p.playerId, secret: p.playerSecret };
  const id = randomHex(16);
  const secret = randomHex(32);
  updateProfile({ playerId: id, playerSecret: secret });
  return { id, secret };
}

async function call(path, options = {}) {
  const res = await fetch(`${LEADERBOARD_URL.replace(/\/$/, '')}${path}`, {
    ...options,
    headers: { 'content-type': 'application/json', ...(options.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Sunucu yanıtı: ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

// Bitmiş günlük oyunu sıraya ekler ve göndermeyi dener.
export async function submitDaily({ day, guesses, hints, seconds }) {
  if (!leaderboardReady() || getProfile().leaderboard !== true) return null;
  const queue = (getProfile().scoreQueue || []).filter((q) => q.day !== day);
  updateProfile({ scoreQueue: [...queue, { day, guesses, hints, seconds }] });
  return flushScores();
}

// Sıradaki skorları gönderir. Sunucu reddederse (geçersiz skor) o kayıt atılır,
// bağlantı hatasında sırada kalır. Son gönderilen günün puanını döndürür.
export async function flushScores() {
  if (!leaderboardReady() || getProfile().leaderboard !== true) return null;
  const { id, secret } = identity();
  let last = null;
  for (const item of [...(getProfile().scoreQueue || [])]) {
    try {
      last = await call('/v1/skor', { method: 'POST', body: JSON.stringify({ id, secret, name: getProfile().name, ...item }) });
    } catch (e) {
      if (!e.status || e.status >= 500) break; // bağlantı ya da sunucu hatası: sonra tekrar dene
    }
    updateProfile({ scoreQueue: (getProfile().scoreQueue || []).filter((q) => q.day !== item.day) });
  }
  return last;
}

// Oyuncu adını sunucuda günceller. Ad reddedilirse hata mesajı döner.
export async function syncName() {
  if (!leaderboardReady() || getProfile().leaderboard !== true) return null;
  const { id, secret } = identity();
  try {
    await call('/v1/oyuncu', { method: 'POST', body: JSON.stringify({ id, secret, name: getProfile().name }) });
    return null;
  } catch (e) {
    return e.status && e.status < 500 ? e.message : null;
  }
}

export async function fetchBoard(period) {
  const id = getProfile().playerId || '';
  return call(`/v1/tablo?donem=${encodeURIComponent(period)}&id=${id}`);
}
