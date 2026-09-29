// Oyuncu profili ve istatistikler tarayıcıda saklanır. Sunucuya yalnızca oyuncu adı (benzersiz olsun diye)
// ve katılım varsa skor tablosu sonuçları gider.
import { dayKey, DEFAULT_LENGTH } from './game.js';
import {
  resolveStreak, addLengthResult, newlyUnlocked, daysBetween, FREEZE_COST, FREEZE_MAX,
} from './progress.js';

const KEY = 'lingo:v1';

const defaults = () => ({
  name: 'Oyuncu',
  nameSet: false, // ilk açılışta ad sorulana kadar false
  nameClaimed: false, // ad sunucuda bu oyuncuya ayrıldı mı; çevrimdışı girilen ad sonraki açılışta ayrılır
  nameChangedAt: 0, // son ad değişikliğindeki gamesTotal değeri
  gamesTotal: 0, // biten tüm oyunlar (Zamana Karşı turları dahil)
  sound: true,
  haptics: true,
  hardMode: false,
  reminder: false,
  reminderTime: '20:00',
  freezes: 0, // seri koruyucu adedi
  freezeDays: [], // koruyucuyla kurtarılan son günler
  achievements: {}, // rozet kimliği -> açıldığı gün
  byLength: {}, // uzunluk -> { played, wins, dist }
  firstTryWins: 0,
  hardWins: 0,
  noHintWins: 0,
  archiveWins: 0,
  timeAttackMaxWords: 0,
  history: {}, // gün -> günlük kelime kaydı (bugün ve arşiv)
  leaderboard: null, // skor tablosuna katılım: null (sorulmadı), true, false
  playerId: null, // skor tablosu için cihaz kimliği
  playerSecret: null,
  scoreQueue: [], // gönderilmeyi bekleyen günlük skorlar
  boardNameTaken: false, // ad sunucuda başka bir oyuncuda; yeni ad seçilene kadar skor gönderilmez
  theme: 'system',
  length: DEFAULT_LENGTH,
  xp: 0,
  coins: 0,
  streak: 0,
  bestStreak: 0,
  lastWinDay: null,
  played: 0,
  wins: 0,
  distribution: [0, 0, 0, 0, 0, 0],
  timeAttackBest: 0,
  classicCount: 0,
  classic: null, // yarım kalan klasik oyun: { answer, label, guesses, hints, freeHint, seconds }
  quests: { day: null, wordsSolved: 0, firstTry: 0 },
});

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaults();
    const saved = JSON.parse(raw);
    // Eski sürümden gelen profilde oyun sayacı yoksa oynanan oyunlardan başlatılır.
    if (saved.gamesTotal === undefined) saved.gamesTotal = saved.played || 0;
    // Eski sürümde yalnızca bugünün günlük oyunu 'daily' alanında tutuluyordu.
    if (saved.daily?.day) {
      const { day, ...rec } = saved.daily;
      saved.history = { ...(saved.history || {}), [day]: rec };
    }
    delete saved.daily;
    return { ...defaults(), ...saved };
  } catch {
    return defaults();
  }
}

let state = read();

function write() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Gizli sekme ya da kota dolu: oyun bellekte devam eder.
  }
}

export function getProfile() {
  return state;
}

export function updateProfile(patch) {
  state = { ...state, ...patch };
  write();
  return state;
}

// Oyun verileri silinir. Skor tablosu kimliği korunur: sunucudaki kayıt ve adın bu cihaza
// bağlı kalır, sıfırlayıp aynı günün skorunu yeni bir oyuncu gibi yeniden göndermek mümkün olmaz.
export function resetProfile() {
  const { playerId, playerSecret } = state;
  state = { ...defaults(), playerId, playerSecret };
  write();
  return state;
}

export function quests() {
  const today = dayKey();
  if (state.quests.day !== today) {
    state.quests = { day: today, wordsSolved: 0, firstTry: 0 };
    write();
  }
  return state.quests;
}

// Seri, kazanılan günlere göre sayılır: dün de kazandıysan artar, arada gün varsa 1'e döner.
function nextStreak(today) {
  if (state.lastWinDay === today) return state.streak;
  const y = new Date();
  y.setDate(y.getDate() - 1);
  return state.lastWinDay === dayKey(y) ? state.streak + 1 : 1;
}

export function currentStreak() {
  const today = dayKey();
  const y = new Date();
  y.setDate(y.getDate() - 1);
  if (state.lastWinDay === today || state.lastWinDay === dayKey(y)) return state.streak;
  return 0;
}

// length: kelime uzunluğu, hard: zor modda mı oynandı, hintsUsed: kullanılan ipucu,
// archive: arşivden mi oynandı (arşiv oyunları seriyi etkilemez).
export function recordRound({
  won, attempts, xp = 0, coins = 0, countsForStats = true,
  length = null, hard = false, hintsUsed = 0, archive = false,
}) {
  const today = dayKey();
  const q = quests();
  const patch = { xp: state.xp + xp, coins: state.coins + coins };
  if (countsForStats) {
    patch.played = state.played + 1;
    patch.gamesTotal = state.gamesTotal + 1;
    if (length) patch.byLength = addLengthResult(state.byLength, length, won, attempts);
    if (won) {
      patch.wins = state.wins + 1;
      const dist = [...state.distribution];
      dist[attempts - 1] += 1;
      patch.distribution = dist;
    }
  }
  if (won) {
    if (attempts === 1) patch.firstTryWins = state.firstTryWins + 1;
    if (hard) patch.hardWins = state.hardWins + 1;
    if (!hintsUsed) patch.noHintWins = state.noHintWins + 1;
    if (archive) patch.archiveWins = state.archiveWins + 1;
  }
  if (won && !archive) {
    const streak = nextStreak(today);
    patch.streak = streak;
    patch.bestStreak = Math.max(state.bestStreak, streak);
    patch.lastWinDay = today;
  }
  if (won) {
    patch.quests = {
      ...q,
      wordsSolved: q.wordsSolved + 1,
      firstTry: q.firstTry + (attempts === 1 ? 1 : 0),
    };
  }
  return updateProfile(patch);
}

export function countGame() {
  return updateProfile({ gamesTotal: state.gamesTotal + 1 });
}

// Uygulama açılınca ve her ekran değişiminde çağrılır: kaçırılan günleri koruyucuyla doldurur.
// Koruyucu kullanıldıysa ya da seri kırıldıysa bilgi döner, yoksa null.
export function applyStreakFreezes() {
  const today = dayKey();
  const r = resolveStreak(state, today);
  if (!r.used.length && !r.broken) return null;
  updateProfile({
    streak: r.streak,
    lastWinDay: r.lastWinDay,
    freezes: r.freezes,
    freezeDays: [...state.freezeDays, ...r.used].slice(-30),
  });
  return r;
}

export function buyFreeze() {
  if (state.freezes >= FREEZE_MAX) return { ok: false, reason: `En fazla ${FREEZE_MAX} koruyucu taşıyabilirsin` };
  if (state.coins < FREEZE_COST) return { ok: false, reason: 'Yeterli coin yok' };
  updateProfile({ freezes: state.freezes + 1, coins: state.coins - FREEZE_COST });
  return { ok: true };
}

// Yeni tamamlanan rozetleri açar ve coin ödüllerini verir.
export function claimAchievements() {
  const fresh = newlyUnlocked(state);
  if (!fresh.length) return [];
  const today = dayKey();
  const achievements = { ...state.achievements };
  let coins = state.coins;
  for (const a of fresh) {
    achievements[a.id] = today;
    coins += a.reward;
  }
  updateProfile({ achievements, coins });
  return fresh;
}

// Günlük kelime kayıtları (bugün ve arşiv). 120 günden eski kayıtlar silinir.
export function getDayRecord(day) {
  return state.history[day] || null;
}

export function saveDayRecord(day, record) {
  const today = dayKey();
  const history = {};
  for (const [d, rec] of Object.entries({ ...state.history, [day]: record })) {
    if (daysBetween(d, today) <= 120) history[d] = rec;
  }
  updateProfile({ history });
}
