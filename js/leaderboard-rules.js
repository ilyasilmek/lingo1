// Skor tablosu kuralları. Hem uygulama hem de sunucu (server/) bu dosyayı kullanır;
// sunucu, telefondan gelen puana güvenmez ve puanı buradaki kurallarla kendisi hesaplar.
import {
  DAILY_LENGTH, MAX_GUESSES, HINT_MAX, HINT_AFTER_GUESSES, EPOCH_DAY,
  evaluateGuess, seededShuffle, dailyIndex, validateName, cleanName,
} from './game.js';
import { parseDay, daysBetween, addDays } from './progress.js';

export const PERIODS = ['gun', 'hafta', 'ay', 'tum'];
export const PERIOD_LABELS = { gun: 'Bugün', hafta: 'Bu hafta', ay: 'Bu ay', tum: 'Tüm zamanlar' };
export const MIN_SECONDS_PER_GUESS = 3;

// Günün kelimesi: tarih ve cevap listesinden herkes için aynı kelime.
export function dailyAnswerFor(answers, day) {
  const order = seededShuffle(answers);
  return order[dailyIndex(order.length, parseDay(day))];
}

// Tablodaki puan: erken ve hızlı bilmek kazandırır, ipucu puan düşürür. Kaybeden 0 alır.
// Seri çarpanı ve iki kat ödül burada yoktur; herkes aynı ölçüyle karşılaştırılır.
export function leaderboardPoints({ won, attempts, seconds, hints = 0 }) {
  if (!won) return 0;
  const base = (MAX_GUESSES + 1 - attempts) * 100;
  const speed = Math.max(0, 120 - Math.round(seconds));
  return Math.max(10, base + speed - hints * 50);
}

// Oyuncu kimliği: uygulamanın ürettiği 32 karakterlik onaltılık sayı.
export const isPlayerId = (id) => typeof id === 'string' && /^[0-9a-f]{32}$/.test(id);
export const isSecret = (s) => typeof s === 'string' && /^[0-9a-f]{64}$/.test(s);

// Listede herkese görünecek adlar için ek süzgeç (küçük harfe çevrilip aranır).
const BLOCKED = ['amk', 'aq', 'sik', 'orospu', 'piç', 'yarrak', 'yarak', 'göt', 'gavat', 'ibne', 'pezevenk', 'kahpe', 'fuck', 'shit', 'admin', 'lingo'];
export function publicNameProblem(raw) {
  const problem = validateName(raw);
  if (problem) return problem;
  const n = cleanName(raw).toLocaleLowerCase('tr-TR');
  const words = n.split(/[\s._-]+/);
  if (BLOCKED.some((b) => words.includes(b) || (b.length > 3 && n.includes(b)))) return 'Bu ad skor tablosunda kullanılamaz.';
  return null;
}

// Günlük oyun gönderimini doğrular. Geçerliyse { ok: true, won, attempts, points },
// değilse { ok: false, error }.
//   today: sunucunun bugünü ('YYYY-MM-DD'); bir gün önce ve sonrası da kabul edilir (saat dilimi farkı).
export function checkDailySubmission({ day, guesses, hints = 0, seconds }, { answers, valid, today }) {
  if (typeof day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return { ok: false, error: 'Geçersiz tarih' };
  if (daysBetween(EPOCH_DAY, day) < 0) return { ok: false, error: 'Geçersiz tarih' };
  const offset = daysBetween(today, day);
  if (offset < -1 || offset > 1) return { ok: false, error: 'Skor yalnızca günün kelimesi için gönderilebilir' };
  if (!Array.isArray(guesses) || guesses.length < 1 || guesses.length > MAX_GUESSES) return { ok: false, error: 'Geçersiz tahmin sayısı' };
  if (!Number.isInteger(hints) || hints < 0 || hints > HINT_MAX) return { ok: false, error: 'Geçersiz ipucu sayısı' };
  if (!Number.isFinite(seconds) || seconds < 0 || seconds > 86400) return { ok: false, error: 'Geçersiz süre' };

  const answer = dailyAnswerFor(answers, day);
  const first = [...answer][0];
  for (const g of guesses) {
    if (typeof g !== 'string' || [...g].length !== DAILY_LENGTH || !valid.has(g)) return { ok: false, error: 'Geçersiz tahmin' };
    if ([...g][0] !== first) return { ok: false, error: 'Geçersiz tahmin' };
  }
  const hit = guesses.indexOf(answer);
  const won = hit !== -1;
  if (won && hit !== guesses.length - 1) return { ok: false, error: 'Kelime bulunduktan sonra tahmin yapılamaz' };
  if (!won && guesses.length < MAX_GUESSES) return { ok: false, error: 'Oyun bitmemiş' };
  if (hints > 0 && guesses.length <= HINT_AFTER_GUESSES) return { ok: false, error: 'İpucu kuralına uymuyor' };
  if (seconds < guesses.length * MIN_SECONDS_PER_GUESS) return { ok: false, error: 'Süre olanaksız derecede kısa' };

  // Değerlendirme sunucuda da yapılır; sonuç yalnızca doğrulama içindir.
  guesses.forEach((g) => evaluateGuess(g, answer));
  const attempts = guesses.length;
  return { ok: true, won, attempts, points: leaderboardPoints({ won, attempts, seconds, hints }) };
}

// Dönemin başladığı gün. 'tum' için null.
export function periodStart(period, today) {
  if (period === 'gun') return today;
  if (period === 'hafta') {
    const dow = (parseDay(today).getDay() + 6) % 7; // Pazartesi = 0
    return addDays(today, -dow);
  }
  if (period === 'ay') return `${today.slice(0, 8)}01`;
  return null;
}
