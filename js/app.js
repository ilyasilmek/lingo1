import {
  WORD_LENGTH, MAX_GUESSES, TIME_ATTACK_SECONDS, KEYBOARD_ROWS, STATE,
  trUpper, isTurkishLetter, evaluateGuess, keyboardStates, pickHint,
  scoreRound, streakMultiplier, shareText, dayKey, dayNumber, msUntilMidnight,
  seededShuffle, dailyIndex, leagueFor, levelFor,
} from './game.js';
import { ANSWERS, ANSWER_LIST } from './words.js';
import { VALID_WORDS } from './dictionary.js';
import { ICONS } from './icons.js';
import {
  getProfile, updateProfile, resetProfile, quests, currentStreak, recordRound,
} from './storage.js';

const app = document.getElementById('app');
const toasts = document.getElementById('toasts');
const DAILY_ORDER = seededShuffle(ANSWER_LIST);
const HINT_COST = 25;
const DAILY_REWARD_FACTOR = 2;

// Ekran değişince temizlenecek zamanlayıcı ve dinleyiciler.
let cleanups = [];
function onCleanup(fn) { cleanups.push(fn); }
function runCleanups() { cleanups.forEach((fn) => fn()); cleanups = []; }

let session = null;
let lastResult = null;

// ---------- Yardımcılar ----------

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (n) => n.toLocaleString('tr-TR');
function icon(name, cls = '') {
  const paths = ICONS[name];
  if (!paths) return '';
  const d = paths[cls.includes('fill') ? 1 : 0];
  return `<svg class="icon ${cls}" viewBox="0 -960 960 960" aria-hidden="true" focusable="false"><path d="${d}"/></svg>`;
}

function clock(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

function hms(ms) {
  const s = Math.floor(ms / 1000);
  const h = String(Math.floor(s / 3600)).padStart(2, '0');
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const sec = String(s % 60).padStart(2, '0');
  return `${h}:${m}:${sec}`;
}

function toast(message, ms = 1800) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = message;
  toasts.appendChild(el);
  setTimeout(() => el.remove(), ms);
}

function go(hash, { replace = false } = {}) {
  if (location.hash === hash) render();
  else if (replace) location.replace(hash);
  else location.hash = hash;
}

function applyTheme(theme) {
  if (theme === 'light' || theme === 'dark') document.documentElement.dataset.theme = theme;
  else delete document.documentElement.dataset.theme;
}

function initials(name) {
  return trUpper((name || 'O').trim().charAt(0) || 'O');
}

function dailyWord(date = new Date()) {
  return DAILY_ORDER[dailyIndex(DAILY_ORDER.length, date)];
}

function randomWord(exclude = []) {
  const pool = ANSWER_LIST.filter((w) => !exclude.includes(w));
  return pool[Math.floor(Math.random() * pool.length)];
}

// ---------- Ortak parçalar ----------

function headerHome(p) {
  return `
  <header class="topbar">
    <div class="topbar-left">
      <a class="brand" href="#/"><img src="assets/logo.svg" alt=""><span>LİNGO</span></a>
    </div>
    <div class="topbar-right">
      <span class="chip xp" title="Toplam XP">${icon('bolt', 'fill')}${fmt(p.xp)}</span>
      <span class="chip streak" title="Günlük seri">${icon('local_fire_department')}${currentStreak()}</span>
      <a href="#/profil" class="avatar" aria-label="Profil">${esc(initials(p.name))}</a>
    </div>
  </header>`;
}

function headerGame(title) {
  const p = getProfile();
  return `
  <header class="topbar">
    <div class="topbar-left">
      <button class="icon-btn" data-action="back" aria-label="Ana menüye dön">${icon('arrow_back')}</button>
      <img src="assets/logo.svg" alt="" width="28" height="28">
      <h1>${esc(title)}</h1>
    </div>
    <div class="topbar-right">
      <span class="chip xp" id="xp-chip">${icon('bolt', 'fill')}${fmt(p.xp)}</span>
      <a href="#/profil" class="avatar" aria-label="Profil">${esc(initials(p.name))}</a>
    </div>
  </header>`;
}

function bottomNav(active) {
  const items = [
    ['#/', 'home', 'Ana Sayfa', 'home'],
    ['#/oyna/klasik', 'sports_esports', 'Oyna', 'play'],
    ['#/istatistik', 'leaderboard', 'İstatistik', 'stats'],
    ['#/profil', 'person', 'Profil', 'profile'],
  ];
  return `
  <div class="bottom-nav"><nav aria-label="Ana gezinme">
    ${items.map(([href, ic, label, key]) => `
      <a href="${href}" class="${active === key ? 'active' : ''}" ${active === key ? 'aria-current="page"' : ''}>${icon(ic, active === key ? 'fill' : '')}${label}</a>`).join('')}
  </nav></div>`;
}

function bindBack() {
  app.querySelector('[data-action="back"]')?.addEventListener('click', () => {
    if (session && !session.finished && session.mode !== 'daily' && session.guesses.length) {
      if (!confirm('Oyundan çıkmak istiyor musun? Bu tur kaydedilmeyecek.')) return;
    }
    go('#/');
  });
}

// ---------- Ana sayfa ----------

function renderHome() {
  const p = getProfile();
  const q = quests();
  const d = p.daily && p.daily.day === dayKey() ? p.daily : null;
  const dailyDone = d?.finished;
  const winRate = p.played ? Math.round((p.wins / p.played) * 100) : 0;
  const base = scoreRound({ attempts: 3, seconds: 60 });

  app.innerHTML = `
  ${headerHome(p)}
  <main class="page">
    <section class="card hero" aria-labelledby="daily-title">
      <div class="section-head">
        <span class="badge primary">${icon('bolt', 'fill')}Günün kelimesi</span>
        <span class="countdown">${icon('timer')}<span id="midnight">${hms(msUntilMidnight())}</span> kaldı</span>
      </div>
      <h2 id="daily-title">Günün Şifresini Çöz</h2>
      <p>Herkes aynı 5 harfli kelimeyi arıyor. 6 denemede bul, ödülü iki katı al.</p>
      <div class="mini-tiles" aria-hidden="true">
        <span class="correct">L</span><span class="absent">İ</span><span class="present">N</span><span class="absent">G</span><span class="correct">O</span>
      </div>
      <div class="reward-row">
        <span>${icon('stars', 'fill')} ~${fmt(base.xp * DAILY_REWARD_FACTOR)} XP · ${base.coins * DAILY_REWARD_FACTOR} Coin</span>
        <span class="badge solid">Ödül x${DAILY_REWARD_FACTOR}</span>
      </div>
      ${dailyDone
        ? `<button class="btn btn-soft btn-block" data-go="#/oyna/gunluk">${icon('task_alt')}${d.won ? `Bugün ${d.guesses.length}. denemede bildin` : 'Bugünkü kelime kaçtı'} · Sonucu Gör</button>`
        : `<button class="btn btn-primary btn-block" data-go="#/oyna/gunluk">${icon('play_arrow', 'fill')}${d?.guesses?.length ? 'DEVAM ET' : 'HEMEN OYNA'}</button>`}
    </section>

    <section class="stat-grid" aria-label="Özet">
      <div class="stat"><span class="dot primary">${icon('local_fire_department')}</span><strong>${currentStreak()} Gün</strong><small>Seri</small></div>
      <div class="stat"><span class="dot mint">${icon('donut_large')}</span><strong>%${winRate}</strong><small>Galibiyet</small></div>
      <div class="stat"><span class="dot amber">${icon('trophy')}</span><strong>${leagueFor(p.xp)}</strong><small>Mevcut lig</small></div>
    </section>

    <section aria-labelledby="modes-title" style="display:flex;flex-direction:column;gap:10px">
      <div class="section-head">
        <h2 id="modes-title">Oyun Modları</h2>
        <span class="badge">Seviye ${levelFor(p.xp)}</span>
      </div>
      <div class="modes">
        <button class="mode" data-go="#/oyna/klasik">
          <div class="mode-top"><span class="mode-icon dot mint">${icon('spellcheck')}</span><span class="badge mint">Stratejik</span></div>
          <h3>Klasik 5 Harf</h3>
          <p>6 tahmin hakkı, süre yok. Sadece sen ve kelime.</p>
          <span class="mode-cta mint">Hemen Başla ${icon('arrow_forward')}</span>
        </button>
        <button class="mode" data-go="#/oyna/zaman">
          <div class="mode-top"><span class="mode-icon dot primary">${icon('timer')}</span><span class="badge primary">Turbo hız</span></div>
          <h3>Zamana Karşı</h3>
          <p>${TIME_ATTACK_SECONDS} saniyede bildiğin kadar kelime. En iyin: ${fmt(p.timeAttackBest)} puan.</p>
          <span class="mode-cta primary">Hemen Başla ${icon('arrow_forward')}</span>
        </button>
        <button class="mode" disabled aria-disabled="true">
          <div class="mode-top"><span class="mode-icon dot blue">${icon('swords')}</span><span class="badge">Yakında</span></div>
          <h3>Düello PvP</h3>
          <p>Canlı 1'e 1 eşleşme. Sunucu tarafı henüz yok.</p>
        </button>
        <button class="mode" disabled aria-disabled="true">
          <div class="mode-top"><span class="mode-icon dot blue">${icon('meeting_room')}</span><span class="badge">Yakında</span></div>
          <h3>Özel Oda</h3>
          <p>Oda kodu ile arkadaşlarınla oyna.</p>
        </button>
      </div>
    </section>

    <section class="card" aria-labelledby="quests-title" style="display:flex;flex-direction:column;gap:14px">
      <div class="section-head">
        <h2 id="quests-title">${icon('task_alt')}Günlük Görevler</h2>
        <span class="muted small">Yenilenme: <span id="quest-reset">${hms(msUntilMidnight()).slice(0, 5)}</span></span>
      </div>
      ${questRow('3 kelime bil', q.wordsSolved, 3)}
      ${questRow('İlk denemede doğru tahmin et', q.firstTry, 1)}
    </section>
  </main>
  ${bottomNav('home')}`;

  app.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => go(b.dataset.go)));

  const tick = setInterval(() => {
    const left = msUntilMidnight();
    const m = document.getElementById('midnight');
    if (m) m.textContent = hms(left);
    const r = document.getElementById('quest-reset');
    if (r) r.textContent = hms(left).slice(0, 5);
    if (left < 1000) setTimeout(render, 1500);
  }, 1000);
  onCleanup(() => clearInterval(tick));
}

function questRow(label, value, target) {
  const v = Math.min(value, target);
  const done = v >= target;
  return `
  <div class="quest">
    <div class="quest-row"><span>${label}</span><span class="${done ? 'done' : ''}">${v} / ${target}${done ? ' ✓' : ''}</span></div>
    <div class="bar ${done ? 'mint' : ''}"><span style="width:${(v / target) * 100}%"></span></div>
  </div>`;
}

// ---------- Oyun ----------

function newSession(mode) {
  const p = getProfile();
  const base = {
    mode,
    guesses: [],
    evaluations: [],
    current: [],
    hints: [],
    freeHint: true,
    finished: false,
    won: false,
    busy: false,
    startedAt: Date.now(),
    elapsedBefore: 0,
  };
  if (mode === 'daily') {
    const today = dayKey();
    const answer = dailyWord();
    const saved = p.daily && p.daily.day === today ? p.daily : null;
    return {
      ...base,
      answer,
      label: `Kelime #${dayNumber() + 1}`,
      guesses: saved ? [...saved.guesses] : [],
      evaluations: saved ? saved.guesses.map((g) => evaluateGuess(g, answer)) : [],
      hints: saved ? [...(saved.hints || [])] : [],
      freeHint: saved ? !(saved.hints || []).length : true,
      finished: saved?.finished || false,
      won: saved?.won || false,
      elapsedBefore: saved?.seconds || 0,
    };
  }
  if (mode === 'time') {
    return {
      ...base,
      answer: randomWord(),
      label: 'Kelime 1',
      deadline: Date.now() + TIME_ATTACK_SECONDS * 1000,
      wordStartedAt: Date.now(),
      solved: [],
      missed: [],
      totalScore: 0,
    };
  }
  updateProfile({ classicCount: p.classicCount + 1 });
  return { ...base, answer: randomWord([dailyWord()]), label: `Klasik #${p.classicCount + 1}` };
}

function elapsedSeconds(s = session) {
  return s.elapsedBefore + (Date.now() - s.startedAt) / 1000;
}

function saveDaily() {
  if (session.mode !== 'daily') return;
  updateProfile({
    daily: {
      day: dayKey(),
      guesses: session.guesses,
      hints: session.hints,
      finished: session.finished,
      won: session.won,
      seconds: Math.round(elapsedSeconds()),
    },
  });
}

function renderGame(mode) {
  session = newSession(mode);
  if (session.finished) {
    lastResult = buildResult(session, { alreadyRecorded: true });
    go('#/sonuc', { replace: true });
    return;
  }

  const multiplier = streakMultiplier(currentStreak());
  const legend = `
    <div class="legend">
      <span><i style="background:var(--correct-bg)"></i>Tam yerinde</span>
      <span><i style="background:var(--present-bg)"></i>Farklı yerde</span>
      <span><i style="background:var(--absent-bg)"></i>Kelimede yok</span>
    </div>`;

  app.innerHTML = `
  ${headerGame(mode === 'time' ? 'Zamana Karşı' : 'Oyun Alanı')}
  <main class="page game">
    <section class="card tight meta">
      <div class="meta-row">
        <div>
          <span class="badge" id="round-label">${esc(session.label)}</span>
          <span class="badge mint">● ${WORD_LENGTH} Harfli</span>
        </div>
        <div>
          ${mode === 'time'
            ? `<span class="badge primary" title="Bilinen kelime">${icon('check_circle')}<span id="solved-count">0</span></span>`
            : `<span class="badge primary" title="Seri çarpanı">${icon('local_fire_department')}x${multiplier.toFixed(2).replace(/\.?0+$/, '')}</span>`}
          <button class="badge hint-btn" id="hint-btn" aria-label="İpucu al">${icon('lightbulb')}<span id="hint-label"></span></button>
        </div>
      </div>
      <div class="meta-progress">
        <div class="bar"><span id="progress" style="width:0%"></span></div>
        <span class="timer" id="timer">${icon('timer')}<span id="timer-text">00:00</span></span>
      </div>
    </section>
    ${legend}
    <div class="board" id="board" aria-label="Tahmin tahtası">
      ${Array.from({ length: MAX_GUESSES }, (_, r) => `
        <div class="row" data-row="${r}">
          ${Array.from({ length: WORD_LENGTH }, (_, c) => `
            <div class="tile" data-col="${c}">
              <div class="tile-inner"><div class="face front"></div><div class="face back"></div></div>
            </div>`).join('')}
        </div>`).join('')}
    </div>
    <div class="keyboard" id="keyboard" aria-label="Klavye">
      ${KEYBOARD_ROWS.map((row) => `
        <div class="kb-row">
          ${row.map((k) => {
            if (k === 'ENTER') return `<button class="key wide enter" data-key="ENTER" aria-label="Onayla">${icon('check')}ONAY</button>`;
            if (k === 'BACKSPACE') return `<button class="key wide" data-key="BACKSPACE" aria-label="Sil">${icon('backspace')}</button>`;
            return `<button class="key" data-key="${k}">${k}</button>`;
          }).join('')}
        </div>`).join('')}
    </div>
  </main>`;

  bindBack();
  paintBoard({ restore: true });
  paintKeyboard();
  paintHint();
  paintProgress();

  app.querySelectorAll('.key').forEach((k) => k.addEventListener('click', () => {
    handleKey(k.dataset.key);
    k.blur();
  }));
  app.querySelector('#hint-btn').addEventListener('click', useHint);

  const onKey = (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'Enter') { e.preventDefault(); handleKey('ENTER'); return; }
    if (e.key === 'Backspace') { e.preventDefault(); handleKey('BACKSPACE'); return; }
    const ch = trUpper(e.key);
    if (isTurkishLetter(ch)) handleKey(ch);
  };
  window.addEventListener('keydown', onKey);
  onCleanup(() => window.removeEventListener('keydown', onKey));

  const tick = setInterval(updateTimer, 250);
  updateTimer();
  onCleanup(() => clearInterval(tick));

  const onHide = () => { if (document.hidden) saveDaily(); };
  document.addEventListener('visibilitychange', onHide);
  onCleanup(() => { document.removeEventListener('visibilitychange', onHide); if (session && !session.finished) saveDaily(); });
}

function rowEl(r) { return app.querySelector(`.row[data-row="${r}"]`); }

function paintBoard({ restore = false } = {}) {
  const rows = app.querySelectorAll('.row');
  rows.forEach((row, r) => {
    const tiles = row.querySelectorAll('.tile');
    const done = r < session.guesses.length;
    tiles.forEach((tile, c) => {
      const front = tile.querySelector('.front');
      const back = tile.querySelector('.back');
      tile.classList.remove('filled', 'active-row', 'hinted', 'cursor');
      if (done) {
        const ch = session.guesses[r][c];
        front.textContent = ch;
        back.textContent = ch;
        back.className = `face back ${session.evaluations[r][c]}`;
        if (restore) {
          tile.querySelector('.tile-inner').style.transition = 'none';
          tile.classList.add('flipped');
          requestAnimationFrame(() => { tile.querySelector('.tile-inner').style.transition = ''; });
        }
        tile.setAttribute('aria-label', `${ch}, ${stateLabel(session.evaluations[r][c])}`);
      } else if (r === session.guesses.length && !session.finished) {
        const ch = session.current[c];
        tile.classList.add('active-row');
        if (ch) {
          front.textContent = ch;
          tile.classList.add('filled');
        } else if (session.hints.includes(c)) {
          front.textContent = session.answer[c];
          tile.classList.add('hinted');
        } else {
          front.textContent = '';
        }
        if (c === session.current.length) tile.classList.add('cursor');
        tile.removeAttribute('aria-label');
      } else {
        front.textContent = '';
        back.textContent = '';
        back.className = 'face back';
        tile.classList.remove('flipped');
        tile.removeAttribute('aria-label');
      }
    });
  });
}

function stateLabel(s) {
  return s === STATE.CORRECT ? 'tam yerinde' : s === STATE.PRESENT ? 'farklı yerde' : 'kelimede yok';
}

function paintKeyboard() {
  const states = keyboardStates(session.guesses, session.evaluations);
  app.querySelectorAll('.key[data-key]').forEach((k) => {
    const s = states[k.dataset.key];
    k.classList.remove('correct', 'present', 'absent');
    if (s) k.classList.add(s);
  });
}

function paintHint() {
  const btn = app.querySelector('#hint-btn');
  const label = app.querySelector('#hint-label');
  if (!btn) return;
  const coins = getProfile().coins;
  if (session.freeHint) {
    label.textContent = '1';
    btn.title = 'Ücretsiz ipucu';
    btn.disabled = session.finished;
  } else {
    label.textContent = `${HINT_COST}¢`;
    btn.title = `${HINT_COST} coin karşılığı ipucu (bakiye: ${coins})`;
    btn.disabled = session.finished || coins < HINT_COST;
  }
}

function paintProgress() {
  const bar = app.querySelector('#progress');
  if (!bar) return;
  if (session.mode === 'time') {
    const left = Math.max(0, session.deadline - Date.now());
    bar.style.width = `${(left / (TIME_ATTACK_SECONDS * 1000)) * 100}%`;
  } else {
    bar.style.width = `${(session.guesses.length / MAX_GUESSES) * 100}%`;
  }
}

function updateTimer() {
  if (!session) return;
  const text = app.querySelector('#timer-text');
  const timer = app.querySelector('#timer');
  if (!text) return;
  if (session.mode === 'time') {
    const left = (session.deadline - Date.now()) / 1000;
    text.textContent = clock(Math.ceil(left));
    timer.classList.toggle('low', left <= 10);
    paintProgress();
    if (left <= 0 && !session.finished) finishTimeAttack();
  } else if (!session.finished) {
    text.textContent = clock(elapsedSeconds());
  }
}

function handleKey(key) {
  if (!session || session.finished || session.busy) return;
  if (key === 'ENTER') return submitGuess();
  if (key === 'BACKSPACE') {
    if (session.current.length) {
      session.current.pop();
      paintBoard();
    }
    return;
  }
  if (session.current.length >= WORD_LENGTH) return;
  session.current.push(key);
  paintBoard();
  const tile = rowEl(session.guesses.length)?.querySelectorAll('.tile')[session.current.length - 1];
  if (tile) {
    tile.classList.remove('pop');
    void tile.offsetWidth;
    tile.classList.add('pop');
  }
}

function shakeRow(message) {
  const row = rowEl(session.guesses.length);
  row.classList.remove('shake');
  void row.offsetWidth;
  row.classList.add('shake');
  toast(message);
}

function submitGuess() {
  if (session.current.length < WORD_LENGTH) return shakeRow('Kelime 5 harfli olmalı');
  const guess = session.current.join('');
  if (!VALID_WORDS.has(guess)) return shakeRow('Bu kelime listede yok');

  const evaluation = evaluateGuess(guess, session.answer);
  const r = session.guesses.length;
  session.guesses.push(guess);
  session.evaluations.push(evaluation);
  session.current = [];
  session.busy = true;

  const row = rowEl(r);
  const tiles = row.querySelectorAll('.tile');
  tiles.forEach((tile, c) => {
    const back = tile.querySelector('.back');
    back.textContent = guess[c];
    back.className = `face back ${evaluation[c]}`;
    tile.classList.remove('active-row', 'cursor', 'hinted');
    tile.querySelector('.tile-inner').style.transitionDelay = `${c * 250}ms`;
    tile.classList.add('flipped');
    tile.setAttribute('aria-label', `${guess[c]}, ${stateLabel(evaluation[c])}`);
  });

  const won = evaluation.every((s) => s === STATE.CORRECT);
  const lost = !won && session.guesses.length >= MAX_GUESSES;
  if (won || lost) {
    session.finished = session.mode !== 'time';
    session.won = won;
  }
  saveDaily();

  const revealMs = (WORD_LENGTH - 1) * 250 + 650;
  setTimeout(() => {
    if (!app.contains(row)) return;
    tiles.forEach((t) => { t.querySelector('.tile-inner').style.transitionDelay = ''; });
    session.busy = false;
    paintKeyboard();
    paintProgress();
    if (session.mode === 'time') return afterTimeGuess(won, lost);
    if (won) {
      row.classList.add('win');
      setTimeout(() => finishRound(), 900);
    } else if (lost) {
      toast(session.answer, 2500);
      setTimeout(() => finishRound(), 1400);
    } else {
      paintBoard();
    }
  }, revealMs);
}

function useHint() {
  if (!session || session.finished || session.busy) return;
  const idx = pickHint(session.answer, session.guesses, session.evaluations, session.hints);
  if (idx === null) return toast('Tüm harflerin yeri zaten belli');
  if (session.freeHint) {
    session.freeHint = false;
  } else {
    const p = getProfile();
    if (p.coins < HINT_COST) return toast('Yeterli coin yok');
    updateProfile({ coins: p.coins - HINT_COST });
  }
  session.hints.push(idx);
  toast(`${idx + 1}. harf: ${session.answer[idx]}`);
  saveDaily();
  paintHint();
  paintBoard();
}

function finishRound() {
  const s = session;
  lastResult = buildResult(s, { alreadyRecorded: false });
  go('#/sonuc');
}

function buildResult(s, { alreadyRecorded }) {
  const seconds = Math.round(elapsedSeconds(s));
  const attempts = s.guesses.length;
  const streakBefore = currentStreak();
  let reward = { score: 0, xp: 0, coins: 0, speedBonus: 0, multiplier: 1 };
  if (s.won) {
    reward = scoreRound({ attempts, seconds, streak: streakBefore, hintsUsed: s.hints.length });
    if (s.mode === 'daily') {
      reward = { ...reward, xp: reward.xp * DAILY_REWARD_FACTOR, coins: reward.coins * DAILY_REWARD_FACTOR };
    }
  }
  if (!alreadyRecorded) {
    recordRound({ won: s.won, attempts, xp: reward.xp, coins: reward.coins });
  }
  return {
    mode: s.mode,
    label: s.label,
    answer: s.answer,
    won: s.won,
    attempts,
    seconds,
    guesses: s.guesses,
    evaluations: s.evaluations,
    reward,
    streak: currentStreak(),
    alreadyRecorded,
  };
}

// Zamana karşı modu: kelime bilinince ya da 6 hak bitince yeni kelimeye geçilir.
function afterTimeGuess(won, lost) {
  const s = session;
  if (won) {
    const seconds = (Date.now() - s.wordStartedAt) / 1000;
    const r = scoreRound({ attempts: s.guesses.length, seconds, hintsUsed: s.hints.length });
    s.totalScore += r.score + r.speedBonus;
    s.solved.push({ word: s.answer, attempts: s.guesses.length });
    rowEl(s.guesses.length - 1).classList.add('win');
    toast(`+${fmt(r.score + r.speedBonus)} puan`);
    setTimeout(nextTimeWord, 700);
  } else if (lost) {
    s.missed.push(s.answer);
    toast(`Kaçtı: ${s.answer}`);
    setTimeout(nextTimeWord, 900);
  } else {
    paintBoard();
  }
}

function nextTimeWord() {
  const s = session;
  if (!s || s.mode !== 'time' || s.finished) return;
  const used = [...s.solved.map((x) => x.word), ...s.missed];
  s.answer = randomWord(used);
  s.guesses = [];
  s.evaluations = [];
  s.current = [];
  s.hints = [];
  s.freeHint = true;
  s.wordStartedAt = Date.now();
  s.label = `Kelime ${used.length + 1}`;
  app.querySelector('#round-label').textContent = s.label;
  app.querySelector('#solved-count').textContent = s.solved.length;
  app.querySelectorAll('.row').forEach((row) => row.classList.remove('win'));
  app.querySelectorAll('.tile').forEach((t) => {
    const inner = t.querySelector('.tile-inner');
    inner.style.transition = 'none';
    t.classList.remove('flipped');
    requestAnimationFrame(() => { inner.style.transition = ''; });
  });
  paintBoard();
  paintKeyboard();
  paintHint();
}

function finishTimeAttack() {
  const s = session;
  s.finished = true;
  const p = getProfile();
  const coins = s.solved.length * 10;
  const best = Math.max(p.timeAttackBest, s.totalScore);
  updateProfile({ xp: p.xp + s.totalScore, coins: p.coins + coins, timeAttackBest: best });
  s.solved.forEach((w) => recordRound({ won: true, attempts: w.attempts, countsForStats: false }));
  lastResult = {
    mode: 'time',
    solved: s.solved,
    missed: s.missed,
    current: s.answer,
    totalScore: s.totalScore,
    coins,
    isBest: s.totalScore > 0 && s.totalScore >= best && s.totalScore > p.timeAttackBest,
  };
  go('#/sonuc');
}

// ---------- Sonuç ----------

function renderResult() {
  const r = lastResult;
  if (!r) return go('#/');
  if (r.mode === 'time') return renderTimeResult(r);

  const meaning = ANSWERS[r.answer];
  const title = r.won ? (r.attempts <= 2 ? 'EFSANE!' : r.attempts <= 4 ? 'MUHTEŞEM ZAFER!' : 'KIL PAYI!') : 'BU SEFER OLMADI';
  const sub = r.won
    ? `Tebrikler, kelimeyi <b>${r.attempts}. denemede</b> bildin.`
    : r.mode === 'daily'
      ? 'Kelimeyi bulamadın. Yarın yeni kelimeyle tekrar dene.'
      : 'Kelimeyi bulamadın. Sıradakinde şansını dene.';
  const shareLabel = r.mode === 'daily' ? `Lingo ${r.label.replace('Kelime ', '')}` : `Lingo ${r.label}`;

  app.innerHTML = `
  ${headerGame('Oyun Alanı')}
  <main class="page">
    <section class="result-head">
      <span class="badge primary">${icon('star_shine')}${esc(r.label)} tamamlandı</span>
      <h2>${title}</h2>
      <p>${sub}</p>
    </section>

    <section class="card">
      <div class="answer-tiles ${r.won ? '' : 'lost'}">
        ${[...r.answer].map((ch, i) => `<span style="animation-delay:${i * 80}ms">${ch}</span>`).join('')}
      </div>
      ${meaning ? `
      <div class="meaning">
        <div class="small">${icon('menu_book')}Anlamı</div>
        <p><b>${r.answer.charAt(0)}${r.answer.slice(1).toLocaleLowerCase('tr-TR')}:</b> ${esc(meaning)}</p>
      </div>` : ''}
    </section>

    <section class="kv-grid">
      <div class="kv"><span class="dot blue">${icon('timer')}</span><div><small>Süre</small><strong>${r.seconds} sn</strong></div></div>
      <div class="kv"><span class="dot primary">${icon('bolt')}</span><div><small>Skor</small><strong class="primary">+${fmt(r.reward.score)}</strong></div></div>
      <div class="kv"><span class="dot blue">${icon('track_changes')}</span><div><small>Deneme</small><strong>${r.won ? r.attempts : 'X'} / ${MAX_GUESSES}</strong></div></div>
      <div class="kv"><span class="dot mint">${icon('speed')}</span><div><small>Hız bonusu</small><strong class="mint">+${r.reward.speedBonus} XP</strong></div></div>
    </section>

    ${r.won ? `
    <section class="card" style="display:flex;flex-direction:column;gap:12px">
      <div class="section-head"><span class="small muted" style="text-transform:uppercase">Kazanılan ödüller</span>
        ${r.mode === 'daily' ? `<span class="badge solid">x${DAILY_REWARD_FACTOR}</span>` : ''}</div>
      <div class="kv-grid">
        <div class="kv" style="background:var(--surface-low);box-shadow:none"><span class="dot amber">${icon('paid')}</span><div><strong>+${r.reward.coins}</strong><small>Coin</small></div></div>
        <div class="kv" style="background:var(--surface-low);box-shadow:none"><span class="dot primary">${icon('local_fire_department')}</span><div><strong>${r.streak} Gün</strong><small>Seri</small></div></div>
      </div>
    </section>` : ''}

    <section class="card" style="display:flex;flex-direction:column;gap:12px">
      <div class="section-head">
        <h2 style="font-size:18px">${icon('share')}Skorunu Paylaş</h2>
        <span class="small muted">${esc(shareLabel)} ${r.won ? r.attempts : 'X'}/${MAX_GUESSES}</span>
      </div>
      <div class="share-grid">
        ${r.guesses.map((g, i) => `<div>${[...g].map((ch, c) => `<span class="${r.evaluations[i][c]}">${ch}</span>`).join('')}</div>`).join('')}
      </div>
      <button class="btn btn-soft btn-block" id="copy">${icon('content_copy')}Skoru Kopyala</button>
    </section>

    ${r.mode === 'daily'
      ? `<button class="btn btn-primary btn-block" data-go="#/oyna/klasik">KLASİK MODDA DEVAM ET ${icon('arrow_forward')}</button>`
      : `<button class="btn btn-primary btn-block" data-go="#/oyna/klasik">SONRAKİ KELİMEYE GEÇ ${icon('arrow_forward')}</button>`}
    <button class="btn btn-ghost" data-go="#/">${icon('home')}Ana Menüye Dön</button>
  </main>`;

  bindBack();
  app.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => go(b.dataset.go)));
  app.querySelector('#copy').addEventListener('click', () => {
    const text = shareText({ label: shareLabel, won: r.won, evaluations: r.evaluations });
    copy(text);
  });
  if (r.won && !r.alreadyRecorded) confetti();
}

function renderTimeResult(r) {
  app.innerHTML = `
  ${headerGame('Zamana Karşı')}
  <main class="page">
    <section class="result-head">
      <span class="badge primary">${icon('timer')}Süre doldu</span>
      <h2>${r.solved.length ? `${r.solved.length} KELİME!` : 'SÜRE BİTTİ'}</h2>
      <p>${r.isBest ? '<b>Yeni rekor!</b> ' : ''}${TIME_ATTACK_SECONDS} saniyede ${fmt(r.totalScore)} puan topladın.</p>
    </section>
    <section class="kv-grid">
      <div class="kv"><span class="dot primary">${icon('bolt')}</span><div><small>Toplam puan</small><strong class="primary">${fmt(r.totalScore)}</strong></div></div>
      <div class="kv"><span class="dot amber">${icon('paid')}</span><div><small>Coin</small><strong>+${r.coins}</strong></div></div>
    </section>
    <section class="card" style="display:flex;flex-direction:column;gap:10px">
      <h2 style="font-size:18px">Kelimeler</h2>
      ${r.solved.map((w) => `<div class="quest-row"><span>${w.word}</span><span class="badge mint">${w.attempts}. deneme</span></div>`).join('')}
      ${r.missed.map((w) => `<div class="quest-row"><span>${w}</span><span class="badge">Kaçtı</span></div>`).join('')}
      <div class="quest-row"><span class="muted">Yarım kalan: ${r.current}</span></div>
      ${ANSWERS[r.current] ? `<p class="muted" style="margin:0">${esc(ANSWERS[r.current])}</p>` : ''}
    </section>
    <button class="btn btn-primary btn-block" data-go="#/oyna/zaman">${icon('replay')}TEKRAR OYNA</button>
    <button class="btn btn-ghost" data-go="#/">${icon('home')}Ana Menüye Dön</button>
  </main>`;
  bindBack();
  app.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => go(b.dataset.go)));
  if (r.solved.length) confetti();
}

async function copy(text) {
  try {
    if (navigator.share && matchMedia('(pointer: coarse)').matches) {
      await navigator.share({ text });
      return;
    }
    await navigator.clipboard.writeText(text);
    toast('Panoya kopyalandı');
  } catch (e) {
    if (e?.name === 'AbortError') return;
    toast('Kopyalanamadı');
  }
}

function confetti() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const colors = ['#ff8a4c', '#34d399', '#ec9700', '#64f9bc', '#ffb693', '#d3e4fe'];
  const box = document.createElement('div');
  box.className = 'confetti';
  for (let i = 0; i < 90; i++) {
    const p = document.createElement('i');
    p.style.left = `${Math.random() * 100}%`;
    p.style.background = colors[i % colors.length];
    p.style.setProperty('--dx', `${(Math.random() - 0.5) * 200}px`);
    p.style.setProperty('--rot', `${Math.random() * 720 - 360}deg`);
    p.style.animationDuration = `${2 + Math.random() * 1.8}s`;
    p.style.animationDelay = `${Math.random() * 0.6}s`;
    if (i % 3 === 0) p.style.borderRadius = '50%';
    box.appendChild(p);
  }
  document.body.appendChild(box);
  const t = setTimeout(() => box.remove(), 5000);
  onCleanup(() => { clearTimeout(t); box.remove(); });
}

// ---------- İstatistik ----------

function renderStats() {
  const p = getProfile();
  const winRate = p.played ? Math.round((p.wins / p.played) * 100) : 0;
  const max = Math.max(1, ...p.distribution);
  const lastDaily = p.daily && p.daily.day === dayKey() && p.daily.won ? p.daily.guesses.length : 0;

  app.innerHTML = `
  ${headerHome(p)}
  <main class="page">
    <h2 style="margin:0;font-size:28px;line-height:36px">İstatistikler</h2>
    <section class="stat-grid">
      <div class="stat"><strong>${p.played}</strong><small>Oynanan</small></div>
      <div class="stat"><strong>%${winRate}</strong><small>Galibiyet</small></div>
      <div class="stat"><strong>${p.wins}</strong><small>Kazanılan</small></div>
      <div class="stat"><strong>${currentStreak()}</strong><small>Güncel seri</small></div>
      <div class="stat"><strong>${p.bestStreak}</strong><small>En iyi seri</small></div>
      <div class="stat"><strong>${fmt(p.timeAttackBest)}</strong><small>Zaman rekoru</small></div>
    </section>
    <section class="card" style="display:flex;flex-direction:column;gap:12px">
      <h2 style="font-size:18px">Tahmin dağılımı</h2>
      <div class="dist">
        ${p.distribution.map((n, i) => `
          <div class="dist-row"><span>${i + 1}</span>
            <span class="dist-bar ${lastDaily === i + 1 ? 'hl' : ''}" style="width:${Math.max(8, (n / max) * 100)}%">${n}</span>
          </div>`).join('')}
      </div>
    </section>
    <section class="kv-grid">
      <div class="kv"><span class="dot primary">${icon('bolt')}</span><div><small>Toplam XP</small><strong>${fmt(p.xp)}</strong></div></div>
      <div class="kv"><span class="dot amber">${icon('paid')}</span><div><small>Coin</small><strong>${fmt(p.coins)}</strong></div></div>
      <div class="kv"><span class="dot mint">${icon('military_tech')}</span><div><small>Seviye</small><strong>${levelFor(p.xp)}</strong></div></div>
      <div class="kv"><span class="dot blue">${icon('trophy')}</span><div><small>Lig</small><strong>${leagueFor(p.xp)}</strong></div></div>
    </section>
    <p class="muted" style="margin:0">Liderlik tablosu için sunucu gerekiyor. Şimdilik istatistikler yalnızca bu cihazda tutuluyor.</p>
  </main>
  ${bottomNav('stats')}`;
}

// ---------- Profil ----------

function renderProfile() {
  const p = getProfile();
  app.innerHTML = `
  ${headerHome(p)}
  <main class="page">
    <h2 style="margin:0;font-size:28px;line-height:36px">Profil</h2>
    <section class="card" style="display:flex;flex-direction:column;gap:16px">
      <div class="field">
        <label for="name">Oyuncu adı</label>
        <input id="name" class="input" maxlength="20" value="${esc(p.name)}" autocomplete="nickname">
      </div>
      <div class="field">
        <label id="theme-label">Tema</label>
        <div class="segmented" role="group" aria-labelledby="theme-label">
          ${[['system', 'Sistem'], ['light', 'Açık'], ['dark', 'Koyu']].map(([v, l]) => `
            <button data-theme="${v}" aria-pressed="${p.theme === v}">${l}</button>`).join('')}
        </div>
      </div>
    </section>
    <section class="card" style="display:flex;flex-direction:column;gap:10px">
      <h2 style="font-size:18px">Nasıl oynanır?</h2>
      <ul class="rules">
        <li>5 harfli Türkçe kelimeyi 6 denemede bul.</li>
        <li><b style="color:var(--correct-ink)">Yeşil</b>: harf doğru yerde.</li>
        <li><b style="color:var(--present-ink)">Turuncu</b>: harf kelimede var ama başka yerde.</li>
        <li><b>Mavi-gri</b>: harf kelimede yok.</li>
        <li>Her kelimede bir ipucu bedava. Sonrakiler ${HINT_COST} coin.</li>
        <li>Günün kelimesi herkes için aynıdır ve gece yarısı yenilenir.</li>
      </ul>
    </section>
    <button class="btn btn-ghost" id="reset" style="color:var(--danger)">${icon('delete')}Tüm verileri sıfırla</button>
  </main>
  ${bottomNav('profile')}`;

  const name = app.querySelector('#name');
  name.addEventListener('change', () => {
    updateProfile({ name: name.value.trim() || 'Oyuncu' });
    render();
  });
  app.querySelectorAll('[data-theme]').forEach((b) => b.addEventListener('click', () => {
    updateProfile({ theme: b.dataset.theme });
    applyTheme(b.dataset.theme);
    render();
  }));
  app.querySelector('#reset').addEventListener('click', () => {
    if (!confirm('XP, coin, seri ve istatistiklerin silinecek. Emin misin?')) return;
    resetProfile();
    applyTheme('system');
    toast('Veriler sıfırlandı');
    render();
  });
}

// ---------- Yönlendirme ----------

const routes = {
  '': renderHome,
  'oyna/gunluk': () => renderGame('daily'),
  'oyna/klasik': () => renderGame('classic'),
  'oyna/zaman': () => renderGame('time'),
  sonuc: renderResult,
  istatistik: renderStats,
  profil: renderProfile,
};

function render() {
  runCleanups();
  const path = location.hash.replace(/^#\/?/, '');
  const view = routes[path] || renderHome;
  if (!path.startsWith('oyna')) session = null;
  window.scrollTo(0, 0);
  view();
}

applyTheme(getProfile().theme);
window.addEventListener('hashchange', render);
render();
