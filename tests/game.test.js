import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateGuess, keyboardStates, pickHint, scoreRound, shareText, trUpper,
  dailyIndex, seededShuffle, leagueFor, WORD_LENGTH, ALPHABET, KEYBOARD_ROWS,
} from '../js/game.js';
import { ANSWERS, ANSWER_LIST } from '../js/words.js';
import { VALID_WORDS } from '../js/dictionary.js';

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

test('ipucu yalnızca bilinmeyen pozisyonları seçer', () => {
  const evals = [evaluateGuess('KALEM', 'KABLO')];
  const idx = pickHint('KABLO', ['KALEM'], evals, [2], () => 0);
  assert.equal(idx, 3);
  assert.equal(pickHint('KABLO', ['KABLO'], [evaluateGuess('KABLO', 'KABLO')]), null);
});

test('puanlama erken bilmeyi ödüllendirir', () => {
  const early = scoreRound({ attempts: 2, seconds: 30 });
  const late = scoreRound({ attempts: 6, seconds: 30 });
  assert.ok(early.score > late.score);
  assert.ok(scoreRound({ attempts: 3, seconds: 30, streak: 4 }).score > scoreRound({ attempts: 3, seconds: 30 }).score);
});

test('paylaşım metni', () => {
  const t = shareText({ label: 'Lingo #1', won: true, evaluations: [[C, C, C, C, C]] });
  assert.equal(t, 'Lingo #1 1/6\n\n🟩🟩🟩🟩🟩');
});

test('günlük kelime deterministik ve listede', () => {
  const list = seededShuffle(ANSWER_LIST);
  const d = new Date(2026, 8, 29, 12);
  assert.equal(list[dailyIndex(list.length, d)], list[dailyIndex(list.length, new Date(2026, 8, 29, 23))]);
  assert.notEqual(dailyIndex(list.length, d), dailyIndex(list.length, new Date(2026, 8, 30, 1)));
  assert.equal(seededShuffle(ANSWER_LIST).join(), list.join());
});

test('tüm cevaplar 5 harfli, Türkçe harflerden oluşuyor ve sözlükte', () => {
  for (const w of ANSWER_LIST) {
    assert.equal([...w].length, WORD_LENGTH, w);
    for (const ch of w) assert.ok(ALPHABET.includes(ch), `${w}: ${ch}`);
    assert.ok(VALID_WORDS.has(w), w);
    assert.ok(ANSWERS[w].length > 5, w);
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
