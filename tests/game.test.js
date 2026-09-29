import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  evaluateGuess, keyboardStates, knownLetters, pickHint, scoreRound, shareText, trUpper,
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

test('paylaşım metni', () => {
  const t = shareText({ label: 'Lingo #1', won: true, evaluations: [[C, C, C, C, C]] });
  assert.equal(t, 'Lingo #1 1/6\n\n🟩🟩🟩🟩🟩');
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
