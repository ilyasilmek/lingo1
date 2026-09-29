import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateGuess } from '../js/game.js';
import {
  addDays, daysBetween, resolveStreak, hardModeViolation, addLengthResult,
  ACHIEVEMENTS, achievementProgress, newlyUnlocked, archiveDays, reminderSchedule,
} from '../js/progress.js';

test('tarih yardımcıları ay ve yıl sınırını geçer', () => {
  assert.equal(addDays('2026-02-28', 1), '2026-03-01');
  assert.equal(addDays('2026-01-01', -1), '2025-12-31');
  assert.equal(daysBetween('2026-09-27', '2026-09-29'), 2);
});

test('seri koruyucu: kaçırılan gün kadar koruyucu harcar', () => {
  const r = resolveStreak({ streak: 6, lastWinDay: '2026-09-26', freezes: 2 }, '2026-09-29');
  assert.deepEqual(r.used, ['2026-09-27', '2026-09-28']);
  assert.equal(r.freezes, 0);
  assert.equal(r.streak, 6);
  assert.equal(r.lastWinDay, '2026-09-28');
  assert.equal(r.broken, false);
});

test('seri koruyucu: dün kazanıldıysa bir şey harcanmaz', () => {
  const r = resolveStreak({ streak: 3, lastWinDay: '2026-09-28', freezes: 1 }, '2026-09-29');
  assert.deepEqual(r.used, []);
  assert.equal(r.freezes, 1);
});

test('seri koruyucu yetmezse seri kırılır, koruyucu harcanmaz', () => {
  const r = resolveStreak({ streak: 9, lastWinDay: '2026-09-20', freezes: 2 }, '2026-09-29');
  assert.equal(r.broken, true);
  assert.equal(r.streak, 0);
  assert.equal(r.freezes, 2);
});

test('zor mod: yeşil harf yerinde kalmalı, turuncu harf kullanılmalı', () => {
  const guesses = ['KALEM'];
  const evals = [evaluateGuess('KALEM', 'KABLO')]; // K,A yeşil; L turuncu
  assert.equal(hardModeViolation('KİTAP', guesses, evals), '2. harf A olmalı');
  assert.equal(hardModeViolation('KAZAN', guesses, evals), 'Tahmin L harfini içermeli');
  assert.equal(hardModeViolation('KABLO', guesses, evals), null);
  assert.equal(hardModeViolation('KALEM', [], []), null);
});

test('uzunluğa göre istatistik', () => {
  let s = addLengthResult({}, 7, true, 3);
  s = addLengthResult(s, 7, false, 6);
  s = addLengthResult(s, 4, true, 1);
  assert.deepEqual(s[7], { played: 2, wins: 1, dist: [0, 0, 1, 0, 0, 0] });
  assert.equal(s[4].wins, 1);
});

test('rozetler: tamamlananlar açılır, açılanlar tekrar gelmez', () => {
  const p = { wins: 1, firstTryWins: 0, bestStreak: 7, byLength: { 9: { wins: 1 } }, hardWins: 0, noHintWins: 0, timeAttackMaxWords: 0, archiveWins: 0, achievements: {} };
  const ids = newlyUnlocked(p).map((a) => a.id).sort();
  assert.deepEqual(ids, ['first-win', 'long-word', 'streak-7']);
  const again = newlyUnlocked({ ...p, achievements: { 'first-win': '2026-09-29', 'long-word': '2026-09-29', 'streak-7': '2026-09-29' } });
  assert.equal(again.length, 0);
  const allLengths = ACHIEVEMENTS.find((a) => a.id === 'all-lengths');
  assert.deepEqual(achievementProgress(p, allLengths), { cur: 1, goal: 6, done: false, unlockedAt: null });
  assert.equal(new Set(ACHIEVEMENTS.map((a) => a.id)).size, ACHIEVEMENTS.length);
});

test('arşiv: bugün hariç, ilk günden önceye gitmez', () => {
  assert.deepEqual(archiveDays('2026-01-04', '2026-01-01'), ['2026-01-03', '2026-01-02', '2026-01-01']);
  assert.equal(archiveDays('2026-09-29', '2026-01-01', 60).length, 60);
});

test('hatırlatma: bugün oynandıysa ya da saat geçtiyse bugün atlanır', () => {
  const morning = new Date(2026, 8, 29, 8, 0);
  let list = reminderSchedule({ time: '20:00', streak: 4 }, morning, 3);
  assert.equal(list.length, 3);
  assert.equal(list[0].at.getDate(), 29);
  assert.match(list[0].title, /4 günde/);
  list = reminderSchedule({ time: '20:00', playedToday: true }, morning, 3);
  assert.equal(list[0].at.getDate(), 30);
  list = reminderSchedule({ time: '20:00' }, new Date(2026, 8, 29, 21, 0), 3);
  assert.equal(list[0].at.getDate(), 30);
  assert.equal(new Set(list.map((n) => n.id)).size, 3);
});

import { archiveAccess, openArchiveDay } from '../js/progress.js';

test('arşiv: bugün bitmeden kapalı', () => {
  const r = archiveAccess({ todayFinished: false }, '2026-09-27');
  assert.equal(r.allowed, false);
  assert.match(r.reason, /bugünün kelimesini/);
  assert.equal(archiveAccess({ todayFinished: true }, '2026-09-27').allowed, true);
});

test('arşiv: yarım kalan gün bitene kadar yalnızca o gün açık', () => {
  const history = {
    '2026-09-29': { guesses: ['KALEM'], finished: false },
    '2026-09-25': { guesses: ['KİTAP', 'KALEM'], finished: false },
    '2026-09-24': { guesses: ['KABLO'], finished: true },
    '2026-09-23': { guesses: [], finished: false },
  };
  const open = openArchiveDay(history, '2026-09-29');
  assert.equal(open, '2026-09-25');
  assert.equal(archiveAccess({ todayFinished: true, openDay: open }, '2026-09-25').allowed, true);
  const other = archiveAccess({ todayFinished: true, openDay: open }, '2026-09-20');
  assert.equal(other.allowed, false);
  assert.match(other.reason, /yarım kalan/);
  assert.equal(openArchiveDay({}, '2026-09-29'), null);
});
