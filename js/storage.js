// Oyuncu profili ve istatistikler tarayıcıda saklanır. Sunucu yok.
import { dayKey } from './game.js';

const KEY = 'lingo:v1';

const defaults = () => ({
  name: 'Oyuncu',
  theme: 'system',
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
  daily: null, // { day, guesses, hints, startedAt, finished, won, seconds }
  quests: { day: null, wordsSolved: 0, firstTry: 0 },
});

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...defaults(), ...JSON.parse(raw) } : defaults();
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

export function resetProfile() {
  state = defaults();
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

export function recordRound({ won, attempts, xp = 0, coins = 0, countsForStats = true }) {
  const today = dayKey();
  const q = quests();
  const patch = { xp: state.xp + xp, coins: state.coins + coins };
  if (countsForStats) {
    patch.played = state.played + 1;
    if (won) {
      patch.wins = state.wins + 1;
      const dist = [...state.distribution];
      dist[attempts - 1] += 1;
      patch.distribution = dist;
    }
  }
  if (won) {
    const streak = nextStreak(today);
    patch.streak = streak;
    patch.bestStreak = Math.max(state.bestStreak, streak);
    patch.lastWinDay = today;
    patch.quests = {
      ...q,
      wordsSolved: q.wordsSolved + 1,
      firstTry: q.firstTry + (attempts === 1 ? 1 : 0),
    };
  }
  return updateProfile(patch);
}
