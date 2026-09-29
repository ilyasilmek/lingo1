// Oyunun DOM'dan bağımsız mantığı. Node testleri de bu dosyayı doğrudan kullanır.

export const MIN_LENGTH = 4;
export const MAX_LENGTH = 9;
export const DEFAULT_LENGTH = 5;
export const DAILY_LENGTH = 5;
export const MAX_GUESSES = 6;
export const TIME_ATTACK_SECONDS = 60;

export const ALPHABET = 'ABCÇDEFGĞHIİJKLMNOÖPRSŞTUÜVYZ';

export const KEYBOARD_ROWS = [
  ['E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P', 'Ğ', 'Ü'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'Ş', 'İ'],
  ['ENTER', 'Z', 'C', 'V', 'B', 'N', 'M', 'Ö', 'Ç', 'BACKSPACE'],
];

export const STATE = { CORRECT: 'correct', PRESENT: 'present', ABSENT: 'absent' };
const RANK = { absent: 1, present: 2, correct: 3 };

export function trUpper(text) {
  return text.toLocaleUpperCase('tr-TR');
}

export function isTurkishLetter(ch) {
  return ch.length === 1 && ALPHABET.includes(ch);
}

// Tahmindeki her harf için correct / present / absent döndürür.
// Tekrarlayan harfler Wordle kuralıyla sayılır: önce tam eşleşmeler düşülür,
// kalan harf adedi kadar "present" verilir.
export function evaluateGuess(guess, answer) {
  const g = [...guess];
  const a = [...answer];
  if (g.length !== a.length) throw new Error('Tahmin ve cevap aynı uzunlukta olmalı');

  const result = new Array(g.length).fill(STATE.ABSENT);
  const remaining = new Map();

  for (let i = 0; i < a.length; i++) {
    if (g[i] === a[i]) result[i] = STATE.CORRECT;
    else remaining.set(a[i], (remaining.get(a[i]) || 0) + 1);
  }
  for (let i = 0; i < g.length; i++) {
    if (result[i] === STATE.CORRECT) continue;
    const left = remaining.get(g[i]) || 0;
    if (left > 0) {
      result[i] = STATE.PRESENT;
      remaining.set(g[i], left - 1);
    }
  }
  return result;
}

// Klavye tuşlarının rengini, o harf için şimdiye kadar görülen en iyi durum belirler.
export function keyboardStates(guesses, evaluations) {
  const states = {};
  guesses.forEach((word, row) => {
    [...word].forEach((ch, i) => {
      const s = evaluations[row][i];
      if (!states[ch] || RANK[s] > RANK[states[ch]]) states[ch] = s;
    });
  });
  return states;
}

// Lingo kuralı: ilk harf baştan açıktır, doğru yerde bulunan harfler ve ipuçları
// sonraki satırlarda da gösterilir. Pozisyon -> harf.
export function knownLetters(answer, evaluations, hints = []) {
  const known = new Map([[0, answer[0]]]);
  evaluations.forEach((row) => row.forEach((s, i) => s === STATE.CORRECT && known.set(i, answer[i])));
  hints.forEach((i) => known.set(i, answer[i]));
  return known;
}

// Henüz bilinmeyen bir pozisyonu açar. İlk harf zaten açık olduğu için hiç seçilmez.
// Hepsi biliniyorsa null.
export function pickHint(answer, guesses, evaluations, revealed = [], rand = Math.random) {
  const known = new Set([0, ...revealed]);
  evaluations.forEach((row) => row.forEach((s, i) => s === STATE.CORRECT && known.add(i)));
  const open = [...answer].map((_, i) => i).filter((i) => !known.has(i));
  if (!open.length) return null;
  return open[Math.floor(rand() * open.length)];
}

// Puan: erken ve hızlı bilmek ödüllendirilir, uzun kelime daha çok puan getirir.
// Seri çarpanı en sonda uygulanır.
export function streakMultiplier(streak) {
  return Math.min(3, 1 + Math.max(0, streak) * 0.25);
}

export function scoreRound({ attempts, seconds, streak = 0, hintsUsed = 0, length = DEFAULT_LENGTH }) {
  const base = Math.round(((MAX_GUESSES + 1 - attempts) * 100 * length) / DEFAULT_LENGTH);
  const speedBonus = Math.max(0, 120 + (length - DEFAULT_LENGTH) * 20 - Math.round(seconds));
  const hintPenalty = hintsUsed * 50;
  const multiplier = streakMultiplier(streak);
  const score = Math.max(0, Math.round((base - hintPenalty) * multiplier));
  const coins = 10 + (MAX_GUESSES - attempts) * 5;
  return { base, speedBonus, hintPenalty, multiplier, score, xp: score + speedBonus, coins };
}

// Tarih yardımcıları (yerel saate göre gün).
// Günlük kelime sayacının başladığı gün (Kelime #1).
export const EPOCH_DAY = '2026-01-01';
const EPOCH = new Date(2026, 0, 1);

export function dayKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function dayNumber(date = new Date()) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.round((start - EPOCH) / 86400000);
}

export function msUntilMidnight(date = new Date()) {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
  return next - date;
}

function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Kelimeleri sabit tohumla karıştırır; aynı gün herkes aynı kelimeyi görür.
export function seededShuffle(list, seed = 20260101) {
  const out = [...list];
  const rand = mulberry32(seed);
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function dailyIndex(listLength, date = new Date()) {
  const n = dayNumber(date);
  return ((n % listLength) + listLength) % listLength;
}

// XP'ye göre lig.
const LEAGUES = [
  [0, 'Bronz'],
  [1500, 'Gümüş'],
  [5000, 'Altın'],
  [12000, 'Platin'],
  [25000, 'Elmas'],
];
export function leagueFor(xp) {
  let name = LEAGUES[0][1];
  for (const [min, label] of LEAGUES) if (xp >= min) name = label;
  return name;
}

export function levelFor(xp) {
  return 1 + Math.floor(Math.sqrt(Math.max(0, xp) / 100));
}

// Oyuncu adı. Uygulama sunucusuz olduğu için bu kurallar yalnızca bu cihazda geçerlidir.
export const NAME_MIN = 2;
export const NAME_MAX = 16;
export const NAME_FREE_AFTER_GAMES = 10;
export const NAME_CHANGE_COST = 1000;

export function cleanName(raw) {
  return String(raw ?? '').replace(/\s+/g, ' ').trim();
}

// Geçerliyse null, değilse kullanıcıya gösterilecek hata metni.
export function validateName(raw) {
  const name = cleanName(raw);
  const n = [...name].length;
  if (n < NAME_MIN) return `Ad en az ${NAME_MIN} karakter olmalı.`;
  if (n > NAME_MAX) return `Ad en fazla ${NAME_MAX} karakter olabilir.`;
  if (!/^[\p{L}\p{N} ._-]+$/u.test(name)) return 'Yalnızca harf, rakam, boşluk, nokta, tire ve alt çizgi kullanılabilir.';
  return null;
}

// Son ad değişikliğinden bu yana NAME_FREE_AFTER_GAMES oyun oynandıysa değişiklik ücretsizdir,
// değilse NAME_CHANGE_COST coin karşılığında yapılabilir.
export function nameChangeStatus({ gamesTotal = 0, nameChangedAt = 0, coins = 0 }) {
  const since = Math.max(0, gamesTotal - nameChangedAt);
  const gamesLeft = Math.max(0, NAME_FREE_AFTER_GAMES - since);
  return { free: gamesLeft === 0, gamesLeft, cost: NAME_CHANGE_COST, canPay: coins >= NAME_CHANGE_COST };
}
