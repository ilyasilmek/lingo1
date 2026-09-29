import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  dailyAnswerFor, leaderboardPoints, checkDailySubmission, periodStart, publicNameProblem, isPlayerId, isSecret, nameKey,
} from '../js/leaderboard-rules.js';
import { seededShuffle, dailyIndex } from '../js/game.js';
import { parseDay } from '../js/progress.js';

const list = (n) => readFileSync(new URL(`../data/${n}.txt`, import.meta.url), 'utf8').split('\n').filter(Boolean);
const answers = list('answers-5');
const valid = new Set(list('valid-5'));
const today = '2026-09-29';
const ans = dailyAnswerFor(answers, today);
const wrong = [...valid].filter((w) => w[0] === ans[0] && w !== ans);
const ctx = { answers, valid, today };

test('sunucunun günlük kelimesi uygulamanınkiyle aynı', () => {
  const order = seededShuffle(answers);
  assert.equal(ans, order[dailyIndex(order.length, parseDay(today))]);
});

test('puan: erken, hızlı ve ipuçsuz bilmek kazandırır', () => {
  assert.equal(leaderboardPoints({ won: false, attempts: 6, seconds: 90 }), 0);
  assert.ok(leaderboardPoints({ won: true, attempts: 2, seconds: 30 }) > leaderboardPoints({ won: true, attempts: 4, seconds: 30 }));
  assert.ok(leaderboardPoints({ won: true, attempts: 4, seconds: 30 }) > leaderboardPoints({ won: true, attempts: 4, seconds: 30, hints: 2 }));
  assert.equal(leaderboardPoints({ won: true, attempts: 6, seconds: 999, hints: 3 }), 10);
});

test('geçerli gönderimler kabul edilir', () => {
  const win = checkDailySubmission({ day: today, guesses: [wrong[0], ans], seconds: 20 }, ctx);
  assert.equal(win.ok, true);
  assert.equal(win.won, true);
  assert.equal(win.attempts, 2);
  const lose = checkDailySubmission({ day: today, guesses: wrong.slice(0, 6), seconds: 120 }, ctx);
  assert.deepEqual([lose.ok, lose.won, lose.points], [true, false, 0]);
  assert.equal(checkDailySubmission({ day: '2026-09-28', guesses: [dailyAnswerFor(answers, '2026-09-28')], seconds: 10 }, ctx).ok, true);
});

test('sahte gönderimler reddedilir', () => {
  const bad = (sub) => checkDailySubmission({ day: today, seconds: 60, ...sub }, ctx);
  assert.equal(bad({ guesses: [ans], seconds: 1 }).ok, false);
  assert.equal(bad({ guesses: [wrong[0]] }).ok, false);
  assert.equal(bad({ guesses: [ans, wrong[0]] }).ok, false);
  assert.equal(bad({ guesses: ['ZZZZZ'] }).ok, false);
  assert.equal(bad({ guesses: [[...valid].find((w) => w[0] !== ans[0])] }).ok, false);
  assert.equal(bad({ guesses: [ans], hints: 1 }).ok, false);
  assert.equal(bad({ guesses: [ans], hints: 9 }).ok, false);
  assert.equal(bad({ guesses: [] }).ok, false);
  assert.equal(bad({ guesses: wrong.slice(0, 7) }).ok, false);
  assert.equal(bad({ day: '2026-09-20', guesses: [ans] }).ok, false);
  assert.equal(bad({ day: '2025-12-31', guesses: [ans] }).ok, false);
});

test('dönem başlangıçları (hafta pazartesi başlar)', () => {
  assert.equal(periodStart('gun', today), today);
  assert.equal(periodStart('hafta', '2026-09-29'), '2026-09-28');
  assert.equal(periodStart('hafta', '2026-10-04'), '2026-09-28');
  assert.equal(periodStart('ay', today), '2026-09-01');
  assert.equal(periodStart('tum', today), null);
});

test('herkese açık ad süzgeci ve kimlik biçimi', () => {
  assert.equal(publicNameProblem('Deniz'), null);
  assert.equal(publicNameProblem('Ayşe Nur'), null);
  assert.match(publicNameProblem('orospu'), /kullanılamaz/);
  assert.match(publicNameProblem('amk'), /kullanılamaz/);
  assert.equal(publicNameProblem('Sıkıcı'), null);
  assert.equal(isPlayerId('0123456789abcdef0123456789abcdef'), true);
  assert.equal(isPlayerId('xyz'), false);
  assert.equal(isSecret('a'.repeat(64)), true);
});

test('nameKey: aynı sayılan adlar aynı anahtarı verir', () => {
  const same = ['ilyas', 'İlyas', 'ILYAS', 'ılyas', 'i.lyas', 'il yas', 'Il_Yas', '  ilyas  '];
  for (const n of same) assert.equal(nameKey(n), 'ilyas', n);
  assert.equal(nameKey('Şükrü Çağ'), nameKey('sukru cag'));
  assert.equal(nameKey('Gökçe'), 'gokce');
  assert.notEqual(nameKey('ilyas1'), nameKey('ilyas'));
  assert.notEqual(nameKey('Zeynep'), nameKey('Menna'));
});

test('publicNameProblem: yalnızca işaretten oluşan ad reddedilir', () => {
  assert.ok(publicNameProblem('..'));
  assert.ok(publicNameProblem('a-'));
  assert.equal(publicNameProblem('Ay'), null);
});
