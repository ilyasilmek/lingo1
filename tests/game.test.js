import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  evaluateGuess, keyboardStates, knownLetters, pickHint, scoreRound, trUpper,
  dailyIndex, seededShuffle, leagueFor, ALPHABET, KEYBOARD_ROWS, MIN_LENGTH, MAX_LENGTH,
} from '../js/game.js';

const list = (name) => readFileSync(new URL(`../data/${name}.txt`, import.meta.url), 'utf8').split('\n').filter(Boolean);

const C = 'correct', P = 'present', A = 'absent';

test('tam eşleşme hepsi yeşil', () => {
  assert.deepEqual(evaluateGuess('KABLO', 'KABLO'), [C, C, C, C, C]);
});

test('tasarımdaki örnek: KİLİT -> KABLO', () => {
  assert.deepEqual(evaluateGuess('KİLİT', 'KABLO'), [C, A, P, A, A]);
});

test('tekrarlayan harf, cevapta bir kez geçiyorsa bir kez sayılır', () => {
  // Cevapta tek A var ve 2. sırada; tahmindeki ilk A sarı olmamalı çünkü ikincisi yeşil.
  assert.deepEqual(evaluateGuess('AAZZZ', 'KAZZZ'), [A, C, C, C, C]);
  assert.deepEqual(evaluateGuess('ELMAS', 'SALÇA'), [A, P, A, P, P]);
  assert.deepEqual(evaluateGuess('AAAAA', 'ARABA'), [C, A, C, A, C]);
});

test('İ ve I farklı harflerdir', () => {
  assert.deepEqual(evaluateGuess('IRMAK', 'İRMAK'), [A, C, C, C, C]);
  assert.equal(trUpper('ırmak'), 'IRMAK');
  assert.equal(trUpper('içmek'), 'İÇMEK');
});

test('klavye durumu en iyi sonucu tutar', () => {
  const guesses = ['KİLİT', 'KABLO'];
  const evals = guesses.map((g) => evaluateGuess(g, 'KABLO'));
  const s = keyboardStates(guesses, evals);
  assert.equal(s.L, C);
  assert.equal(s.T, A);
});

test('ipucu yalnızca bilinmeyen pozisyonları seçer, ilk harfi asla', () => {
  const evals = [evaluateGuess('KALEM', 'KABLO')];
  assert.equal(pickHint('KABLO', ['KALEM'], evals, [2], () => 0), 3);
  assert.equal(pickHint('KABLO', ['KABLO'], [evaluateGuess('KABLO', 'KABLO')]), null);
  for (let i = 0; i < 50; i++) assert.notEqual(pickHint('KABLO', [], []), 0);
});

test('ilk harf ve doğru yerdeki harfler sonraki satıra taşınır', () => {
  const k = knownLetters('KABLO', [evaluateGuess('KALEM', 'KABLO')], [4]);
  assert.deepEqual([...k.entries()].sort(), [[0, 'K'], [1, 'A'], [4, 'O']]);
  assert.deepEqual([...knownLetters('KABLO', []).entries()], [[0, 'K']]);
});

test('farklı uzunluklarda değerlendirme', () => {
  assert.deepEqual(evaluateGuess('ELMA', 'EKİM'), [C, A, P, A]);
  assert.deepEqual(evaluateGuess('KAPLUMBAĞ', 'KAPLUMBAĞ'), new Array(9).fill(C));
});

test('puanlama erken bilmeyi ödüllendirir', () => {
  const early = scoreRound({ attempts: 2, seconds: 30 });
  const late = scoreRound({ attempts: 6, seconds: 30 });
  assert.ok(early.score > late.score);
  assert.ok(scoreRound({ attempts: 3, seconds: 30, streak: 4 }).score > scoreRound({ attempts: 3, seconds: 30 }).score);
  assert.ok(scoreRound({ attempts: 3, seconds: 30, length: 8 }).score > scoreRound({ attempts: 3, seconds: 30, length: 4 }).score);
});

test('günlük kelime deterministik', () => {
  const answers = seededShuffle(list('answers-5'));
  const d = new Date(2026, 8, 29, 12);
  assert.equal(answers[dailyIndex(answers.length, d)], answers[dailyIndex(answers.length, new Date(2026, 8, 29, 23))]);
  assert.notEqual(dailyIndex(answers.length, d), dailyIndex(answers.length, new Date(2026, 8, 30, 1)));
  assert.equal(seededShuffle(list('answers-5')).join(), answers.join());
});

test('kelime listeleri: doğru uzunluk, Türkçe alfabe, cevaplar geçerli listede', () => {
  for (let n = MIN_LENGTH; n <= MAX_LENGTH; n++) {
    const valid = list(`valid-${n}`);
    const answers = list(`answers-${n}`);
    const set = new Set(valid);
    assert.ok(valid.length > 1000, `valid-${n}: ${valid.length}`);
    assert.ok(answers.length > 300, `answers-${n}: ${answers.length}`);
    assert.equal(set.size, valid.length, `valid-${n} tekrar içeriyor`);
    for (const w of valid) {
      assert.equal([...w].length, n, w);
      for (const ch of w) assert.ok(ALPHABET.includes(ch), `${w}: ${ch}`);
    }
    for (const w of answers) assert.ok(set.has(w), `${w} valid-${n} içinde yok`);
  }
});

test('her cevap kelimesinin en az bir anlamı var', () => {
  for (let n = MIN_LENGTH; n <= MAX_LENGTH; n++) {
    const meanings = JSON.parse(readFileSync(new URL(`../data/meanings-${n}.json`, import.meta.url), 'utf8'));
    for (const w of list(`answers-${n}`)) {
      assert.ok(Array.isArray(meanings[w]) && meanings[w].length > 0, `${w} anlamsız`);
      for (const m of meanings[w]) assert.ok(m.length >= 8, `${w}: "${m}"`);
    }
  }
});

test('klavye alfabenin tamamını kapsıyor', () => {
  const keys = KEYBOARD_ROWS.flat().filter((k) => k.length === 1);
  assert.equal(new Set(keys).size, ALPHABET.length);
  for (const ch of ALPHABET) assert.ok(keys.includes(ch), ch);
});

test('lig eşikleri', () => {
  assert.equal(leagueFor(0), 'Bronz');
  assert.equal(leagueFor(5000), 'Altın');
});

import { validateName, cleanName, nameChangeStatus, NAME_CHANGE_COST } from '../js/game.js';

test('oyuncu adı doğrulama', () => {
  assert.equal(validateName('Deniz'), null);
  assert.equal(validateName('  Ayşe   Nur '), null);
  assert.equal(cleanName('  Ayşe   Nur '), 'Ayşe Nur');
  assert.equal(validateName('İlyas_42'), null);
  assert.match(validateName('a'), /en az/);
  assert.match(validateName('a'.repeat(17)), /en fazla/);
  assert.match(validateName('<script>'), /Yalnızca/);
  assert.match(validateName('   '), /en az/);
});

test('ad değiştirme: 10 oyun sonra ücretsiz, öncesinde 1000 coin', () => {
  let st = nameChangeStatus({ gamesTotal: 4, nameChangedAt: 0, coins: 200 });
  assert.equal(st.free, false);
  assert.equal(st.gamesLeft, 6);
  assert.equal(st.canPay, false);
  st = nameChangeStatus({ gamesTotal: 4, nameChangedAt: 0, coins: NAME_CHANGE_COST });
  assert.equal(st.canPay, true);
  st = nameChangeStatus({ gamesTotal: 25, nameChangedAt: 15, coins: 0 });
  assert.equal(st.free, true);
  assert.equal(st.gamesLeft, 0);
  st = nameChangeStatus({ gamesTotal: 25, nameChangedAt: 20, coins: 0 });
  assert.equal(st.gamesLeft, 5);
});

import { hintStatus, HINT_MAX } from '../js/game.js';

test('ipucu: 3 tahminden önce kapalı', () => {
  const g = ['KALEM', 'KİTAP'];
  const st = hintStatus('KABLO', g, g.map((w) => evaluateGuess(w, 'KABLO')));
  assert.equal(st.allowed, false);
  assert.match(st.reason, /4\. tahmin/);
});

test('ipucu: 4. tahminde açılır, en fazla 3 tane', () => {
  const g = ['KARAKTER', 'KAPSAMLI', 'KARAMSAR'];
  const ev = g.map((w) => evaluateGuess(w, 'KARANLIK'));
  // Bilinen: K, A, R, A (0-3). Bilinmeyen 4 harf var, 3 ipucu alınabilir.
  assert.equal(hintStatus('KARANLIK', g, ev).left, 3);
  assert.equal(hintStatus('KARANLIK', g, ev).allowed, true);
  assert.equal(hintStatus('KARANLIK', g, ev, [4, 5]).left, 1);
  const full = hintStatus('KARANLIK', g, ev, [4, 5, 6]);
  assert.equal(full.allowed, false);
  assert.equal(full.left, 0);
  assert.equal(HINT_MAX, 3);
});

test('ipucu: son bilinmeyen harf açılmaz (4 harfte en fazla 2)', () => {
  const g = ['EKİM', 'ELÇİ', 'EMİR'];
  const ev = g.map((w) => evaluateGuess(w, 'ELMA'));
  let st = hintStatus('ELMA', g, ev);
  // E açık, L ikinci tahminde yeşil; bilinmeyen: M, A
  assert.equal(st.left, 1);
  st = hintStatus('ELMA', g, ev, [2]);
  assert.equal(st.allowed, false);
  assert.match(st.reason, /Son harfi/);
  const none = hintStatus('ELMA', g, g.map(() => ['correct', 'absent', 'absent', 'absent']));
  assert.equal(none.left, 2);
});
