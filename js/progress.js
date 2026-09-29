// İlerleme kuralları: seri koruyucu, zor mod, rozetler, arşiv ve hatırlatma zamanlaması.
// DOM'a ve depolamaya dokunmaz; testler doğrudan bu fonksiyonları çağırır.
import { STATE, MIN_LENGTH, MAX_LENGTH, dayKey } from './game.js';

// ---------- Tarih yardımcıları ('YYYY-MM-DD', yerel saat) ----------

export function parseDay(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(key, n) {
  const d = parseDay(key);
  d.setDate(d.getDate() + n);
  return dayKey(d);
}

export function daysBetween(from, to) {
  return Math.round((parseDay(to) - parseDay(from)) / 86400000);
}

// ---------- Seri koruyucu ----------

export const FREEZE_COST = 200;
export const FREEZE_MAX = 2;

// Son kazanılan gün ile bugün arasında kaçırılan günler koruyucularla doldurulur.
// Koruyucu yetmezse seri kırılır ve koruyucular harcanmaz.
// used: koruyucuyla kurtarılan günler.
export function resolveStreak({ streak = 0, lastWinDay = null, freezes = 0 }, today) {
  const same = { streak, lastWinDay, freezes, used: [], broken: false };
  if (!lastWinDay || streak <= 0) return same;
  const missed = daysBetween(lastWinDay, today) - 1;
  if (missed <= 0) return same;
  if (missed <= freezes) {
    const used = Array.from({ length: missed }, (_, i) => addDays(lastWinDay, i + 1));
    return { streak, lastWinDay: addDays(today, -1), freezes: freezes - missed, used, broken: false };
  }
  return { streak: 0, lastWinDay, freezes, used: [], broken: true };
}

// ---------- Zor mod ----------

// Zor modda önceki tahminlerde ortaya çıkan ipuçları kullanılmak zorundadır:
// yeşil harfler aynı yerde kalır, turuncu harfler tahminde yer alır.
// Kural ihlal edilmiyorsa null, ediliyorsa kullanıcıya gösterilecek mesaj döner.
export function hardModeViolation(guess, guesses, evaluations) {
  const g = [...guess];
  for (let r = 0; r < guesses.length; r++) {
    const prev = [...guesses[r]];
    const ev = evaluations[r];
    for (let i = 0; i < prev.length; i++) {
      if (ev[i] === STATE.CORRECT && g[i] !== prev[i]) return `${i + 1}. harf ${prev[i]} olmalı`;
    }
    const need = new Map();
    prev.forEach((ch, i) => {
      if (ev[i] === STATE.CORRECT || ev[i] === STATE.PRESENT) need.set(ch, (need.get(ch) || 0) + 1);
    });
    for (const [ch, count] of need) {
      if (g.filter((x) => x === ch).length < count) return `Tahmin ${ch} harfini içermeli`;
    }
  }
  return null;
}

// ---------- Uzunluğa göre istatistik ----------

export function emptyLengthStats() {
  return { played: 0, wins: 0, dist: [0, 0, 0, 0, 0, 0] };
}

export function addLengthResult(byLength = {}, length, won, attempts) {
  const cur = byLength[length] || emptyLengthStats();
  const next = { played: cur.played + 1, wins: cur.wins + (won ? 1 : 0), dist: [...cur.dist] };
  if (won) next.dist[attempts - 1] += 1;
  return { ...byLength, [length]: next };
}

// ---------- Rozetler ----------

const lengthsWon = (p) => {
  let n = 0;
  for (let k = MIN_LENGTH; k <= MAX_LENGTH; k++) if (p.byLength?.[k]?.wins > 0) n++;
  return n;
};

export const ACHIEVEMENTS = [
  { id: 'first-win', icon: 'trophy', title: 'İlk Zafer', desc: 'İlk kelimeni bil.', goal: 1, reward: 50, value: (p) => p.wins },
  { id: 'wins-25', icon: 'workspace_premium', title: 'Kelime Avcısı', desc: '25 kelime bil.', goal: 25, reward: 150, value: (p) => p.wins },
  { id: 'wins-100', icon: 'hotel_class', title: 'Kelime Ustası', desc: '100 kelime bil.', goal: 100, reward: 400, value: (p) => p.wins },
  { id: 'first-try', icon: 'crisis_alert', title: 'Tek Atış', desc: 'Bir kelimeyi ilk denemede bil.', goal: 1, reward: 150, value: (p) => p.firstTryWins },
  { id: 'streak-7', icon: 'local_fire_department', title: 'Bir Hafta', desc: '7 günlük seriye ulaş.', goal: 7, reward: 150, value: (p) => p.bestStreak },
  { id: 'streak-30', icon: 'verified', title: 'Bir Ay', desc: '30 günlük seriye ulaş.', goal: 30, reward: 500, value: (p) => p.bestStreak },
  { id: 'long-word', icon: 'star_shine', title: 'Uzun Soluk', desc: '9 harfli bir kelime bil.', goal: 1, reward: 150, value: (p) => p.byLength?.[9]?.wins || 0 },
  { id: 'all-lengths', icon: 'military_tech', title: 'Her Boyda', desc: '4 ile 9 arasındaki her uzunlukta en az bir kelime bil.', goal: MAX_LENGTH - MIN_LENGTH + 1, reward: 300, value: lengthsWon },
  { id: 'hard-10', icon: 'fitness_center', title: 'Zorlu', desc: 'Zor modda 10 kelime bil.', goal: 10, reward: 250, value: (p) => p.hardWins },
  { id: 'no-hint-20', icon: 'psychology', title: 'Kendi Başına', desc: 'İpucu kullanmadan 20 kelime bil.', goal: 20, reward: 200, value: (p) => p.noHintWins },
  { id: 'speed-5', icon: 'rocket_launch', title: 'Hız Treni', desc: 'Zamana Karşı\'da tek turda 5 kelime bil.', goal: 5, reward: 200, value: (p) => p.timeAttackMaxWords },
  { id: 'archive-10', icon: 'history', title: 'Arşivci', desc: 'Arşivden 10 günün kelimesini bil.', goal: 10, reward: 200, value: (p) => p.archiveWins },
];

export function achievementProgress(profile, a) {
  const cur = Math.max(0, Number(a.value(profile)) || 0);
  return { cur: Math.min(cur, a.goal), goal: a.goal, done: cur >= a.goal, unlockedAt: profile.achievements?.[a.id] || null };
}

export function newlyUnlocked(profile) {
  return ACHIEVEMENTS.filter((a) => !profile.achievements?.[a.id] && achievementProgress(profile, a).done);
}

// ---------- Arşiv ----------

export const ARCHIVE_DAYS = 60;

// Bugünden önceki günler, en yeniden eskiye. İlk gün, günlük kelime sayacının başladığı gündür.
export function archiveDays(today, firstDay, count = ARCHIVE_DAYS) {
  const out = [];
  for (let i = 1; i <= count; i++) {
    const d = addDays(today, -i);
    if (daysBetween(firstDay, d) < 0) break;
    out.push(d);
  }
  return out;
}

// ---------- Günlük hatırlatma ----------

export const REMINDER_TIMES = ['09:00', '12:00', '18:00', '20:00', '21:30'];
export const REMINDER_DAYS = 7;
const REMINDER_ID_BASE = 7100;

// Önümüzdeki günler için bildirim listesi. Bugünün kelimesi çözüldüyse ya da saat geçtiyse
// bugün atlanır. Bildirimler uygulama her açıldığında ve günlük oyun bitince yeniden kurulur.
export function reminderSchedule({ time = '20:00', streak = 0, playedToday = false }, now = new Date(), days = REMINDER_DAYS) {
  const [h, m] = time.split(':').map(Number);
  const list = [];
  for (let i = 0; i < days + 1 && list.length < days; i++) {
    const at = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i, h, m, 0, 0);
    if (i === 0 && (playedToday || at <= now)) continue;
    const s = i <= 1 ? streak : 0;
    list.push({
      id: REMINDER_ID_BASE + list.length,
      at,
      title: s > 0 ? `Serin ${s} günde, bozma!` : 'Günün kelimesi hazır',
      body: s > 0 ? 'Bugünün kelimesini bulup serini sürdür.' : 'İlk harf senden, gerisi 6 denemede. Hadi bir tahmin yap.',
    });
  }
  return list;
}

export const REMINDER_IDS = Array.from({ length: REMINDER_DAYS }, (_, i) => REMINDER_ID_BASE + i);

// Arşiv erişimi. Arşiv, bugünün kelimesi bitince (kazanılınca ya da kaybedilince) açılır;
// böylece geçmiş günleri oynamak isteyen önce bugünü oynar. Yarım kalan bir arşiv oyunu
// varsa o bitene kadar yalnızca o gün oynanabilir.
export function archiveAccess({ todayFinished, openDay = null }, day) {
  if (!todayFinished) return { allowed: false, reason: 'Arşiv, bugünün kelimesini tamamlayınca açılır' };
  if (openDay && openDay !== day) return { allowed: false, reason: 'Önce yarım kalan arşiv oyununu bitir' };
  return { allowed: true, reason: null };
}

// Arşivde başlanıp bitirilmemiş gün (en yenisi). Yoksa null.
export function openArchiveDay(history = {}, today) {
  const open = Object.entries(history)
    .filter(([d, rec]) => d !== today && !rec?.finished && rec?.guesses?.length)
    .map(([d]) => d)
    .sort();
  return open.length ? open[open.length - 1] : null;
}
