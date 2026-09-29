import {
  MIN_LENGTH, MAX_LENGTH, DAILY_LENGTH, MAX_GUESSES, TIME_ATTACK_SECONDS, KEYBOARD_ROWS, STATE,
  trUpper, isTurkishLetter, evaluateGuess, keyboardStates, knownLetters, pickHint, hintStatus, HINT_MAX, HINT_AFTER_GUESSES,
  scoreRound, streakMultiplier, dayKey, dayNumber, msUntilMidnight,
  seededShuffle, dailyIndex, leagueFor, levelFor,
  cleanName, validateName, nameChangeStatus, NAME_MAX, NAME_FREE_AFTER_GAMES, EPOCH_DAY,
} from './game.js';
import { loadWords } from './wordlist.js';
import { ICONS } from './icons.js';
import { feedback } from './feedback.js';
import {
  parseDay, hardModeViolation, ACHIEVEMENTS, achievementProgress, archiveDays,
  FREEZE_COST, FREEZE_MAX, REMINDER_TIMES, emptyLengthStats,
} from './progress.js';
import { remindersSupported, requestReminderPermission, syncReminders } from './notifications.js';
import {
  getProfile, updateProfile, resetProfile, quests, currentStreak, recordRound, countGame,
  applyStreakFreezes, buyFreeze, claimAchievements, getDayRecord, saveDayRecord,
} from './storage.js';

const app = document.getElementById('app');
const toasts = document.getElementById('toasts');
const HINT_COST = 25;
const DAILY_REWARD_FACTOR = 2;

// Ekran değişince temizlenecek zamanlayıcı ve dinleyiciler.
let cleanups = [];
function onCleanup(fn) { cleanups.push(fn); }
function runCleanups() { cleanups.forEach((fn) => fn()); cleanups = []; }

let session = null;
let lastResult = null;
let renderToken = 0;

// ---------- Yardımcılar ----------

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (n) => n.toLocaleString('tr-TR');
const len = (w) => [...w].length;
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

function selectedLength() {
  const n = Number(getProfile().length);
  return n >= MIN_LENGTH && n <= MAX_LENGTH ? n : DAILY_LENGTH;
}

function randomFrom(list, exclude = []) {
  const pool = exclude.length ? list.filter((w) => !exclude.includes(w)) : list;
  return pool[Math.floor(Math.random() * pool.length)];
}

// ---------- Onay penceresi ----------

function dialog({ title, body, actions }) {
  return new Promise((resolve) => {
    const prev = document.activeElement;
    const wrap = document.createElement('div');
    wrap.className = 'modal-backdrop';
    wrap.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <h2 id="modal-title">${title}</h2>
        <p>${body}</p>
        <div class="modal-actions">
          ${actions.map((a, i) => `<button class="btn ${a.primary ? 'btn-primary' : 'btn-soft'} btn-block" data-i="${i}">${a.label}</button>`).join('')}
        </div>
      </div>`;
    const close = (value) => {
      wrap.remove();
      document.removeEventListener('keydown', onKey, true);
      prev?.focus?.();
      resolve(value);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); close(null); }
    };
    wrap.addEventListener('click', (e) => {
      if (e.target === wrap) return close(null);
      const b = e.target.closest('[data-i]');
      if (b) close(actions[Number(b.dataset.i)].value);
    });
    document.addEventListener('keydown', onKey, true);
    document.body.appendChild(wrap);
    wrap.querySelector('[data-i]').focus();
    onCleanup(() => wrap.isConnected && close(null));
  });
}

// Ad giriş penceresi. required ise kapatılamaz; ad girilmeden uygulama kullanılamaz.
// Onaylanırsa temizlenmiş adı, vazgeçilirse null döndürür.
function nameDialog({ title, body, initial = '', confirmLabel = 'Kaydet', required = false }) {
  return new Promise((resolve) => {
    const prev = document.activeElement;
    const wrap = document.createElement('div');
    wrap.className = 'modal-backdrop';
    wrap.innerHTML = `
      <form class="modal" role="dialog" aria-modal="true" aria-labelledby="name-title" novalidate>
        <h2 id="name-title">${title}</h2>
        <p>${body}</p>
        <input class="input" name="name" maxlength="${NAME_MAX}" autocomplete="nickname"
          autocapitalize="words" spellcheck="false" placeholder="Oyuncu adın" value="${esc(initial)}">
        <p class="field-error" role="alert" aria-live="polite"></p>
        <div class="modal-actions">
          <button type="submit" class="btn btn-primary btn-block">${confirmLabel}</button>
          ${required ? '' : '<button type="button" class="btn btn-soft btn-block" data-cancel>Vazgeç</button>'}
        </div>
      </form>`;
    const form = wrap.querySelector('form');
    const input = form.querySelector('input');
    const error = form.querySelector('.field-error');
    const close = (value) => {
      wrap.remove();
      document.removeEventListener('keydown', onKey, true);
      prev?.focus?.();
      resolve(value);
    };
    const onKey = (e) => {
      if (e.key === 'Escape' && !required) { e.stopPropagation(); close(null); }
    };
    input.addEventListener('input', () => { error.textContent = ''; });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const problem = validateName(input.value);
      if (problem) {
        error.textContent = problem;
        feedback.invalid();
        input.focus();
        return;
      }
      close(cleanName(input.value));
    });
    form.querySelector('[data-cancel]')?.addEventListener('click', () => close(null));
    if (!required) wrap.addEventListener('click', (e) => { if (e.target === wrap) close(null); });
    document.addEventListener('keydown', onKey, true);
    document.body.appendChild(wrap);
    input.focus();
    input.select();
    if (!required) onCleanup(() => wrap.isConnected && close(null));
  });
}

// İlk açılışta ad sorulur. Veriler sıfırlanınca da yeniden sorulur.
let askingName = false;
async function ensureName() {
  if (askingName || getProfile().nameSet) return;
  askingName = true;
  const name = await nameDialog({
    title: 'Hoş geldin!',
    body: 'Başlamadan önce sana nasıl hitap edelim? Adın yalnızca bu cihazda saklanır.',
    confirmLabel: 'Başla',
    required: true,
  });
  const p = getProfile();
  updateProfile({ name, nameSet: true, nameChangedAt: p.gamesTotal });
  askingName = false;
  toast(`Merhaba ${name}!`);
  render();
}

async function changeName() {
  const p = getProfile();
  const st = nameChangeStatus(p);
  if (!st.free && !st.canPay) return;
  const name = await nameDialog({
    title: 'Adını değiştir',
    body: st.free
      ? 'Yeni adını yaz. Bu değişiklik ücretsiz.'
      : `Yeni adını yaz. Bu değişiklik <b>${fmt(st.cost)} coin</b> tutar. Bakiyen: ${fmt(p.coins)} coin.`,
    initial: p.name,
    confirmLabel: st.free ? 'Kaydet' : `${fmt(st.cost)} coin öde ve kaydet`,
  });
  if (!name) return;
  if (name === p.name) return toast('Ad aynı kaldı');
  const now = getProfile();
  updateProfile({
    name,
    nameChangedAt: now.gamesTotal,
    coins: st.free ? now.coins : now.coins - st.cost,
  });
  feedback.hint();
  toast(st.free ? 'Adın değişti' : `Adın değişti, ${fmt(st.cost)} coin harcandı`);
  render();
}

// Klasik mod: yarım kalan oyun varsa önce sorar.
async function openClassic() {
  const saved = getProfile().classic;
  if (!saved) return go('#/oyna/klasik');
  const n = len(saved.answer);
  // Hiç tahmin yapılmamış oyunda kaybedilecek bir şey yok; uzunluk değiştiyse sormadan yenisi açılır.
  if (!saved.guesses.length && n !== selectedLength()) {
    abandonClassic();
    return go('#/oyna/klasik');
  }
  const choice = await dialog({
    title: 'Oyuna devam etmek ister misiniz?',
    body: `Yarım kalan ${n} harfli bir oyunun var (${saved.guesses.length}/${MAX_GUESSES} tahmin).`
      + (saved.guesses.length ? ' Yeni oyun başlatırsan bu oyun kaybedilmiş sayılır.' : ''),
    actions: [
      { label: `${icon('play_arrow', 'fill')}Devam`, value: 'continue', primary: true },
      { label: `${icon('replay')}Yeni oyun`, value: 'new' },
    ],
  });
  if (choice === 'continue') go('#/oyna/klasik');
  else if (choice === 'new') {
    abandonClassic();
    go('#/oyna/klasik');
  }
}

function abandonClassic() {
  const saved = getProfile().classic;
  if (!saved) return;
  if (saved.guesses.length) recordRound({ won: false, attempts: saved.guesses.length, length: len(saved.answer) });
  updateProfile({ classic: null });
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
      <a href="${href}" class="${active === key ? 'active' : ''}" ${active === key ? 'aria-current="page"' : ''}
        ${key === 'play' ? 'data-classic' : ''}>${icon(ic, active === key ? 'fill' : '')}${label}</a>`).join('')}
  </nav></div>`;
}

function bindCommon() {
  app.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => go(b.dataset.go)));
  app.querySelectorAll('[data-classic]').forEach((b) => b.addEventListener('click', (e) => {
    e.preventDefault();
    openClassic();
  }));
}

function bindBack() {
  app.querySelector('[data-action="back"]')?.addEventListener('click', () => {
    if (session && !session.finished && session.mode === 'time' && session.solved.length + session.guesses.length) {
      if (!confirm('Oyundan çıkmak istiyor musun? Bu tur kaydedilmeyecek.')) return;
    }
    go('#/');
  });
}

// ---------- Ana sayfa ----------

function renderHome() {
  const p = getProfile();
  const q = quests();
  const n = selectedLength();
  const d = getDayRecord(dayKey());
  const dailyDone = d?.finished;
  const winRate = p.played ? Math.round((p.wins / p.played) * 100) : 0;
  const base = scoreRound({ attempts: 3, seconds: 60 });
  const saved = p.classic;

  app.innerHTML = `
  ${headerHome(p)}
  <main class="page">
    <section class="card hero" aria-labelledby="daily-title">
      <div class="section-head">
        <span class="badge primary">${icon('bolt', 'fill')}Günün kelimesi</span>
        <span class="countdown">${icon('timer')}<span id="midnight">${hms(msUntilMidnight())}</span> kaldı</span>
      </div>
      <h2 id="daily-title">Günün Şifresini Çöz</h2>
      <p>Herkes aynı ${DAILY_LENGTH} harfli kelimeyi arıyor. İlk harf senden, gerisi 6 denemede. Ödül iki katı.</p>
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
      <button class="link-btn" data-go="#/arsiv">${icon('history')}Geçmiş günlerin kelimeleri ${icon('chevron_right')}</button>
    </section>

    <section class="stat-grid" aria-label="Özet">
      <div class="stat tint tint-apricot"><span class="dot primary">${icon('local_fire_department')}</span><strong>${currentStreak()} Gün</strong><small>Seri${p.freezes ? ` · ${icon('shield', 'fill')}${p.freezes}` : ''}</small></div>
      <div class="stat tint tint-mint"><span class="dot mint">${icon('donut_large')}</span><strong>%${winRate}</strong><small>Galibiyet</small></div>
      <div class="stat tint tint-amber"><span class="dot amber">${icon('trophy')}</span><strong>${leagueFor(p.xp)}</strong><small>Mevcut lig</small></div>
    </section>

    <section aria-labelledby="modes-title" style="display:flex;flex-direction:column;gap:10px">
      <div class="section-head">
        <h2 id="modes-title">Oyun Modları</h2>
        <span class="badge">Seviye ${levelFor(p.xp)}</span>
      </div>
      <div class="card tight length-picker tint tint-lilac">
        <span id="length-label" class="small lilac-ink">KELİME UZUNLUĞU</span>
        <div class="length-options" role="radiogroup" aria-labelledby="length-label">
          ${Array.from({ length: MAX_LENGTH - MIN_LENGTH + 1 }, (_, i) => MIN_LENGTH + i).map((k) => `
            <button role="radio" aria-checked="${k === n}" data-length="${k}">${k}</button>`).join('')}
        </div>
      </div>
      <div class="modes">
        <button class="mode tint tint-sky" data-classic>
          <div class="mode-top"><span class="mode-icon dot sky-ink">${icon('spellcheck')}</span><span class="badge tint-chip sky-ink">${saved ? 'Yarım kaldı' : 'Stratejik'}</span></div>
          <h3>Klasik ${n} Harf</h3>
          <p>${saved ? `${len(saved.answer)} harfli oyunun seni bekliyor.` : '6 tahmin hakkı, süre yok. İlk harf açık gelir.'}</p>
          <span class="mode-cta sky-ink">${saved ? 'Devam Et' : 'Hemen Başla'} ${icon('arrow_forward')}</span>
        </button>
        <button class="mode tint tint-rose" data-go="#/oyna/zaman">
          <div class="mode-top"><span class="mode-icon dot rose-ink">${icon('timer')}</span><span class="badge tint-chip rose-ink">Turbo hız</span></div>
          <h3>Zamana Karşı</h3>
          <p>${TIME_ATTACK_SECONDS} saniyede ${n} harfli kelimelerden bildiğin kadar. En iyin: ${fmt(p.timeAttackBest)} puan.</p>
          <span class="mode-cta rose-ink">Hemen Başla ${icon('arrow_forward')}</span>
        </button>
        <button class="mode tint tint-muted" disabled aria-disabled="true">
          <div class="mode-top"><span class="mode-icon dot">${icon('swords')}</span><span class="badge tint-chip">Yakında</span></div>
          <h3>Düello PvP</h3>
          <p>Canlı 1'e 1 eşleşme. Sunucu tarafı henüz yok.</p>
        </button>
        <button class="mode tint tint-muted" disabled aria-disabled="true">
          <div class="mode-top"><span class="mode-icon dot">${icon('meeting_room')}</span><span class="badge tint-chip">Yakında</span></div>
          <h3>Özel Oda</h3>
          <p>Oda kodu ile arkadaşlarınla oyna.</p>
        </button>
      </div>
    </section>

    <section class="card tint tint-sage" aria-labelledby="quests-title" style="display:flex;flex-direction:column;gap:14px">
      <div class="section-head">
        <h2 id="quests-title">${icon('task_alt')}Günlük Görevler</h2>
        <span class="muted small">Yenilenme: <span id="quest-reset">${hms(msUntilMidnight()).slice(0, 5)}</span></span>
      </div>
      ${questRow('3 kelime bil', q.wordsSolved, 3)}
      ${questRow('İlk denemede doğru tahmin et', q.firstTry, 1)}
    </section>
  </main>
  ${bottomNav('home')}`;

  bindCommon();
  app.querySelectorAll('[data-length]').forEach((b) => b.addEventListener('click', () => {
    updateProfile({ length: Number(b.dataset.length) });
    const y = window.scrollY;
    runCleanups();
    renderHome();
    window.scrollTo(0, y);
    app.querySelector(`[data-length="${b.dataset.length}"]`)?.focus();
  }));

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

function baseSession(mode, answer, words) {
  return {
    mode,
    answer,
    length: len(answer),
    words,
    guesses: [],
    evaluations: [],
    current: [],
    hints: [],
    freeHint: true,
    hard: !!getProfile().hardMode,
    finished: false,
    won: false,
    busy: false,
    startedAt: Date.now(),
    elapsedBefore: 0,
  };
}

function restore(s, saved) {
  s.guesses = [...saved.guesses];
  s.evaluations = saved.guesses.map((g) => evaluateGuess(g, s.answer));
  s.hints = [...(saved.hints || [])];
  s.freeHint = saved.freeHint ?? !s.hints.length;
  s.elapsedBefore = saved.seconds || 0;
  if (saved.hard !== undefined) s.hard = !!saved.hard;
  return s;
}

// Bir günün kelimesi: herkes için aynı, tarihten hesaplanır.
function dayAnswer(words, day) {
  const order = seededShuffle(words.answers);
  return order[dailyIndex(order.length, parseDay(day))];
}

const dayTitle = (day) => parseDay(day).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' });

async function newSession(mode, arg) {
  const p = getProfile();
  if (mode === 'daily' || mode === 'archive') {
    const day = mode === 'daily' ? dayKey() : arg;
    const words = await loadWords(DAILY_LENGTH);
    const answer = dayAnswer(words, day);
    const s = baseSession(mode, answer, words);
    s.day = day;
    s.label = mode === 'daily' ? `Kelime #${dayNumber() + 1}` : `Arşiv · ${dayTitle(day)}`;
    const saved = getDayRecord(day);
    if (saved && saved.answer === answer) {
      restore(s, saved);
      s.finished = !!saved.finished;
      s.won = !!saved.won;
    }
    return s;
  }
  if (mode === 'time') {
    const words = await loadWords(selectedLength());
    const s = baseSession(mode, randomFrom(words.answers), words);
    return Object.assign(s, {
      label: 'Kelime 1',
      deadline: Date.now() + TIME_ATTACK_SECONDS * 1000,
      wordStartedAt: Date.now(),
      solved: [],
      missed: [],
      totalScore: 0,
    });
  }
  // Klasik: kayıtlı yarım oyun varsa ondan devam edilir.
  const saved = p.classic;
  if (saved) {
    const words = await loadWords(len(saved.answer));
    const s = restore(baseSession(mode, saved.answer, words), saved);
    s.label = saved.label;
    return s;
  }
  const words = await loadWords(selectedLength());
  const s = baseSession(mode, randomFrom(words.answers), words);
  s.label = `Klasik #${p.classicCount + 1}`;
  updateProfile({ classicCount: p.classicCount + 1 });
  saveProgress(s);
  return s;
}

function elapsedSeconds(s = session) {
  return s.elapsedBefore + (Date.now() - s.startedAt) / 1000;
}

function saveProgress(s = session) {
  if (!s) return;
  const common = {
    answer: s.answer,
    guesses: s.guesses,
    hints: s.hints,
    freeHint: s.freeHint,
    seconds: Math.round(elapsedSeconds(s)),
  };
  if (s.mode === 'daily' || s.mode === 'archive') {
    saveDayRecord(s.day, { ...common, hard: s.hard, finished: s.finished, won: s.won });
  } else if (s.mode === 'classic') {
    updateProfile({ classic: s.finished ? null : { ...common, hard: s.hard, label: s.label } });
  }
}

async function renderGame(mode, arg) {
  const token = renderToken;
  app.innerHTML = `${headerGame('Oyun Alanı')}<main class="page game"><p class="muted" style="text-align:center;margin-top:40px">Kelimeler yükleniyor…</p></main>`;
  bindBack();
  let s;
  try {
    s = await newSession(mode, arg);
  } catch (e) {
    if (token !== renderToken) return;
    app.querySelector('main').innerHTML = `
      <div class="card" style="text-align:center;margin-top:24px">
        <p>Kelime listesi yüklenemedi. Bağlantını kontrol edip tekrar dene.</p>
        <button class="btn btn-primary" data-go="${location.hash}">Tekrar dene</button>
      </div>`;
    bindCommon();
    return;
  }
  if (token !== renderToken) return;
  session = s;

  if (session.finished) {
    lastResult = buildResult(session, { alreadyRecorded: true });
    go('#/sonuc', { replace: true });
    return;
  }
  session.startedAt = Date.now();
  startRow();

  const n = session.length;
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
          <span class="badge mint">● ${n} Harfli</span>
          ${session.hard ? `<span class="badge amber" title="Zor mod">${icon('fitness_center')}Zor</span>` : ''}
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
    <div class="board" id="board" style="--n:${n}" aria-label="Tahmin tahtası">
      ${Array.from({ length: MAX_GUESSES }, (_, r) => `
        <div class="row" data-row="${r}">
          ${Array.from({ length: n }, (_, c) => `
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
    if (e.ctrlKey || e.metaKey || e.altKey || document.querySelector('.modal-backdrop')) return;
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

  const onHide = () => { if (document.hidden && !session?.finished) saveProgress(); };
  document.addEventListener('visibilitychange', onHide);
  onCleanup(() => {
    document.removeEventListener('visibilitychange', onHide);
    if (session && !session.finished) saveProgress();
  });
}

// Her satır, açık olan ilk harfle başlar.
function startRow() {
  session.current = [[...session.answer][0]];
}

function rowEl(r) { return app.querySelector(`.row[data-row="${r}"]`); }

function paintBoard({ restore = false } = {}) {
  const known = knownLetters([...session.answer], session.evaluations, session.hints);
  app.querySelectorAll('.row').forEach((row, r) => {
    const tiles = row.querySelectorAll('.tile');
    const done = r < session.guesses.length;
    tiles.forEach((tile, c) => {
      const front = tile.querySelector('.front');
      const back = tile.querySelector('.back');
      tile.classList.remove('filled', 'active-row', 'hinted', 'cursor', 'locked');
      if (done) {
        const ch = [...session.guesses[r]][c];
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
        if (c === 0) {
          front.textContent = ch;
          tile.classList.add('locked');
        } else if (ch) {
          front.textContent = ch;
          tile.classList.add('filled');
        } else if (known.has(c)) {
          front.textContent = known.get(c);
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
  if (!btn) return;
  const st = hintStatus([...session.answer], session.guesses, session.evaluations, session.hints);
  const coins = getProfile().coins;
  const costText = session.freeHint ? 'ücretsiz' : `${HINT_COST} coin`;
  const off = session.finished || !st.allowed || (!session.freeHint && coins < HINT_COST);
  const locked = session.guesses.length < HINT_AFTER_GUESSES;
  // Buton pasif görünür ama dokunulabilir kalır; dokununca neden açılmadığı söylenir.
  btn.classList.toggle('is-off', off);
  btn.setAttribute('aria-disabled', String(off));
  btn.innerHTML = `${icon(locked ? 'lock' : 'lightbulb')}<span id="hint-label">${locked ? '' : st.left}</span>`;
  btn.title = st.reason || `İpucu (${costText}), bu kelimede ${st.left} ipucu kaldı`;
  btn.setAttribute('aria-label', btn.title);
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
    // Son 5 saniyede her saniye kısa bir tık sesi
    const whole = Math.ceil(left);
    if (whole <= 5 && whole > 0 && whole !== session.lastTick) {
      session.lastTick = whole;
      feedback.tick();
    }
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
    if (session.current.length > 1) {
      session.current.pop();
      feedback.erase();
      paintBoard();
    }
    return;
  }
  if (session.current.length >= session.length) return;
  session.current.push(key);
  feedback.key();
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
  feedback.invalid();
  toast(message);
}

function submitGuess() {
  const n = session.length;
  if (session.current.length < n) return shakeRow(`Kelime ${n} harfli olmalı`);
  const guess = session.current.join('');
  if (!session.words.valid.has(guess)) return shakeRow('Bu kelime TDK sözlüğünde yok');
  if (session.hard) {
    const problem = hardModeViolation(guess, session.guesses, session.evaluations);
    if (problem) return shakeRow(`Zor mod: ${problem}`);
  }

  const evaluation = evaluateGuess(guess, session.answer);
  const r = session.guesses.length;
  session.guesses.push(guess);
  session.evaluations.push(evaluation);
  session.busy = true;

  const row = rowEl(r);
  const tiles = row.querySelectorAll('.tile');
  const letters = [...guess];
  const step = n > 6 ? 180 : 250;
  feedback.submit();
  evaluation.forEach((st, c) => feedback.reveal(st, c, step));
  tiles.forEach((tile, c) => {
    const back = tile.querySelector('.back');
    back.textContent = letters[c];
    back.className = `face back ${evaluation[c]}`;
    tile.classList.remove('active-row', 'cursor', 'hinted', 'locked');
    tile.querySelector('.tile-inner').style.transitionDelay = `${c * step}ms`;
    tile.classList.add('flipped');
    tile.setAttribute('aria-label', `${letters[c]}, ${stateLabel(evaluation[c])}`);
  });

  const won = evaluation.every((s) => s === STATE.CORRECT);
  const lost = !won && session.guesses.length >= MAX_GUESSES;
  if (won || lost) {
    session.finished = session.mode !== 'time';
    session.won = won;
  } else {
    startRow();
  }
  saveProgress();

  const revealMs = (n - 1) * step + 650;
  setTimeout(() => {
    if (!app.contains(row)) return;
    tiles.forEach((t) => { t.querySelector('.tile-inner').style.transitionDelay = ''; });
    session.busy = false;
    paintKeyboard();
    paintProgress();
    paintHint();
    if (session.mode === 'time') return afterTimeGuess(won, lost);
    if (won) {
      row.classList.add('win');
      feedback.win();
      setTimeout(() => finishRound(), 900);
    } else if (lost) {
      feedback.lose();
      toast(session.answer, 2500);
      setTimeout(() => finishRound(), 1400);
    } else {
      paintBoard();
    }
  }, revealMs);
}

function useHint() {
  if (!session || session.finished || session.busy) return;
  const st = hintStatus([...session.answer], session.guesses, session.evaluations, session.hints);
  if (!st.allowed) {
    feedback.invalid();
    return toast(st.reason);
  }
  const idx = pickHint([...session.answer], session.guesses, session.evaluations, session.hints);
  if (idx === null) return toast('Tüm harflerin yeri zaten belli');
  if (session.freeHint) {
    session.freeHint = false;
  } else {
    const p = getProfile();
    if (p.coins < HINT_COST) return toast('Yeterli coin yok');
    updateProfile({ coins: p.coins - HINT_COST });
  }
  session.hints.push(idx);
  feedback.hint();
  toast(`${idx + 1}. harf: ${[...session.answer][idx]}`);
  saveProgress();
  paintHint();
  paintBoard();
}

function finishRound() {
  lastResult = buildResult(session, { alreadyRecorded: false });
  go('#/sonuc');
}

function buildResult(s, { alreadyRecorded }) {
  const seconds = Math.round(elapsedSeconds(s));
  const attempts = s.guesses.length;
  const streakBefore = currentStreak();
  let reward = { score: 0, xp: 0, coins: 0, speedBonus: 0, multiplier: 1 };
  if (s.won) {
    reward = scoreRound({ attempts, seconds, streak: streakBefore, hintsUsed: s.hints.length, length: s.length });
    if (s.mode === 'daily') {
      reward = { ...reward, xp: reward.xp * DAILY_REWARD_FACTOR, coins: reward.coins * DAILY_REWARD_FACTOR };
    }
  }
  if (!alreadyRecorded) {
    recordRound({
      won: s.won, attempts, xp: reward.xp, coins: reward.coins,
      length: s.length, hard: s.hard, hintsUsed: s.hints.length, archive: s.mode === 'archive',
    });
    if (s.mode === 'daily') refreshReminders();
  }
  const newBadges = alreadyRecorded ? [] : claimAchievements();
  return {
    mode: s.mode,
    label: s.label,
    answer: s.answer,
    won: s.won,
    attempts,
    seconds,
    guesses: s.guesses,
    evaluations: s.evaluations,
    meanings: s.words.meanings[s.answer] || [],
    reward,
    streak: currentStreak(),
    alreadyRecorded,
    newBadges,
  };
}

// Zamana karşı modu: kelime bilinince ya da 6 hak bitince yeni kelimeye geçilir.
function afterTimeGuess(won, lost) {
  const s = session;
  if (won) {
    const seconds = (Date.now() - s.wordStartedAt) / 1000;
    const r = scoreRound({ attempts: s.guesses.length, seconds, hintsUsed: s.hints.length, length: s.length });
    s.totalScore += r.score + r.speedBonus;
    s.solved.push({ word: s.answer, attempts: s.guesses.length, hints: s.hints.length });
    rowEl(s.guesses.length - 1).classList.add('win');
    feedback.win();
    toast(`+${fmt(r.score + r.speedBonus)} puan`);
    setTimeout(nextTimeWord, 700);
  } else if (lost) {
    s.missed.push(s.answer);
    feedback.lose();
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
  s.answer = randomFrom(s.words.answers, used);
  s.guesses = [];
  s.evaluations = [];
  s.hints = [];
  s.freeHint = true;
  s.wordStartedAt = Date.now();
  s.label = `Kelime ${used.length + 1}`;
  startRow();
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
  s.solved.forEach((w) => recordRound({ won: true, attempts: w.attempts, countsForStats: false, hintsUsed: w.hints }));
  countGame();
  if (s.solved.length > (getProfile().timeAttackMaxWords || 0)) updateProfile({ timeAttackMaxWords: s.solved.length });
  const newBadges = claimAchievements();
  feedback.timeUp();
  lastResult = {
    mode: 'time',
    solved: s.solved,
    missed: s.missed,
    current: s.answer,
    currentMeanings: s.words.meanings[s.answer] || [],
    totalScore: s.totalScore,
    coins,
    newBadges,
    isBest: s.totalScore > 0 && s.totalScore > p.timeAttackBest,
  };
  go('#/sonuc');
}

// ---------- Sonuç ----------

function meaningBlock(word, meanings = []) {
  if (!meanings.length) return '';
  const title = `${word.charAt(0)}${word.slice(1).toLocaleLowerCase('tr-TR')}`;
  const body = meanings.length === 1
    ? `<p><b>${esc(title)}:</b> ${esc(meanings[0])}</p>`
    : `<p><b>${esc(title)}</b></p><ol>${meanings.map((m) => `<li>${esc(m)}</li>`).join('')}</ol>`;
  return `
    <div class="meaning">
      <div class="small">${icon('menu_book')}Anlamı</div>
      ${body}
    </div>`;
}

// Sonuç ekranlarında ana eylemler ekranın altına sabitlenir; sayfa kaydırılmadan erişilir.
function resultActions(primary) {
  return `
  <div class="result-actions">
    <div class="result-actions-inner">
      <button class="btn btn-soft result-home" data-go="#/" aria-label="Ana sayfa">${icon('home')}<span>Ana Sayfa</span></button>
      ${primary}
    </div>
  </div>`;
}

function badgeCard(list = []) {
  if (!list.length) return '';
  return `
    <section class="card tint tint-amber badge-card">
      <span class="small" style="color:var(--present-ink)">${list.length > 1 ? `${list.length} YENİ ROZET` : 'YENİ ROZET'}</span>
      ${list.map((a) => `
        <div class="badge-line">
          <span class="dot amber">${icon(a.icon, 'fill')}</span>
          <div><strong>${esc(a.title)}</strong><small>${esc(a.desc)}</small></div>
          <span class="badge solid">+${a.reward}</span>
        </div>`).join('')}
    </section>`;
}

function renderResult() {
  const r = lastResult;
  if (!r) return go('#/');
  if (r.mode === 'time') return renderTimeResult(r);

  const n = len(r.answer);
  const title = r.won ? (r.attempts <= 2 ? 'EFSANE!' : r.attempts <= 4 ? 'MUHTEŞEM ZAFER!' : 'KIL PAYI!') : 'BU SEFER OLMADI';
  const sub = r.won
    ? `Tebrikler, kelimeyi <b>${r.attempts}. denemede</b> bildin.`
    : r.mode === 'daily'
      ? 'Kelimeyi bulamadın. Yarın yeni kelimeyle tekrar dene.'
      : r.mode === 'archive'
        ? 'Kelimeyi bulamadın. Arşivde başka günler seni bekliyor.'
      : 'Kelimeyi bulamadın. Sıradakinde şansını dene.';

  app.innerHTML = `
  ${headerGame('Oyun Alanı')}
  <main class="page has-actions">
    <section class="result-head">
      <span class="badge primary">${icon('star_shine')}${esc(r.label)} tamamlandı</span>
      <h2>${title}</h2>
      <p>${sub}</p>
    </section>
    ${badgeCard(r.newBadges)}

    <section class="card">
      <div class="answer-tiles ${r.won ? '' : 'lost'}" style="--n:${n}">
        ${[...r.answer].map((ch, i) => `<span style="animation-delay:${i * 80}ms">${ch}</span>`).join('')}
      </div>
      ${meaningBlock(r.answer, r.meanings)}
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

  </main>
  ${resultActions(
    r.mode === 'archive'
      ? `<button class="btn btn-primary" data-go="#/arsiv">ARŞİVE DÖN ${icon('arrow_forward')}</button>`
      : `<button class="btn btn-primary" data-classic>${r.mode === 'daily' ? 'KLASİK OYNA' : 'SONRAKİ KELİME'} ${icon('arrow_forward')}</button>`,
  )}`;

  bindBack();
  bindCommon();
  if (r.won && !r.alreadyRecorded) confetti();
}

function renderTimeResult(r) {
  app.innerHTML = `
  ${headerGame('Zamana Karşı')}
  <main class="page has-actions">
    <section class="result-head">
      <span class="badge primary">${icon('timer')}Süre doldu</span>
      <h2>${r.solved.length ? `${r.solved.length} KELİME!` : 'SÜRE BİTTİ'}</h2>
      <p>${r.isBest ? '<b>Yeni rekor!</b> ' : ''}${TIME_ATTACK_SECONDS} saniyede ${fmt(r.totalScore)} puan topladın.</p>
    </section>
    ${badgeCard(r.newBadges)}
    <section class="kv-grid">
      <div class="kv"><span class="dot primary">${icon('bolt')}</span><div><small>Toplam puan</small><strong class="primary">${fmt(r.totalScore)}</strong></div></div>
      <div class="kv"><span class="dot amber">${icon('paid')}</span><div><small>Coin</small><strong>+${r.coins}</strong></div></div>
    </section>
    <section class="card" style="display:flex;flex-direction:column;gap:10px">
      <h2 style="font-size:18px">Kelimeler</h2>
      ${r.solved.map((w) => `<div class="quest-row"><span>${w.word}</span><span class="badge mint">${w.attempts}. deneme</span></div>`).join('')}
      ${r.missed.map((w) => `<div class="quest-row"><span>${w}</span><span class="badge">Kaçtı</span></div>`).join('')}
      <div class="quest-row"><span class="muted">Yarım kalan: ${r.current}</span></div>
      ${meaningBlock(r.current, r.currentMeanings)}
    </section>
  </main>
  ${resultActions(`<button class="btn btn-primary" data-go="#/oyna/zaman">${icon('replay')}TEKRAR OYNA</button>`)}`;
  bindBack();
  bindCommon();
  if (r.solved.length) confetti();
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

let statsTab = 'all';

function renderStats() {
  const p = getProfile();
  const tab = statsTab;
  const src = tab === 'all'
    ? { played: p.played, wins: p.wins, dist: p.distribution }
    : (p.byLength?.[tab] || emptyLengthStats());
  const winRate = src.played ? Math.round((src.wins / src.played) * 100) : 0;
  const max = Math.max(1, ...src.dist);
  const today = getDayRecord(dayKey());
  const lastDaily = tab === 'all' && today?.won ? today.guesses.length : 0;
  const unlocked = ACHIEVEMENTS.filter((a) => p.achievements?.[a.id]).length;
  const tabs = ['all', ...Array.from({ length: MAX_LENGTH - MIN_LENGTH + 1 }, (_, i) => String(MIN_LENGTH + i))];

  app.innerHTML = `
  ${headerHome(p)}
  <main class="page">
    <h2 style="margin:0;font-size:28px;line-height:36px">İstatistikler</h2>
    <div class="length-options stats-tabs" role="tablist" aria-label="Kelime uzunluğu">
      ${tabs.map((t) => `<button role="tab" aria-selected="${t === tab}" aria-checked="${t === tab}" data-tab="${t}">${t === 'all' ? 'Tümü' : t}</button>`).join('')}
    </div>
    <section class="stat-grid">
      <div class="stat"><strong>${src.played}</strong><small>Oynanan</small></div>
      <div class="stat"><strong>%${winRate}</strong><small>Galibiyet</small></div>
      <div class="stat"><strong>${src.wins}</strong><small>Kazanılan</small></div>
      ${tab === 'all' ? `
      <div class="stat"><strong>${currentStreak()}</strong><small>Güncel seri</small></div>
      <div class="stat"><strong>${p.bestStreak}</strong><small>En iyi seri</small></div>
      <div class="stat"><strong>${fmt(p.timeAttackBest)}</strong><small>Zaman rekoru</small></div>` : ''}
    </section>
    <section class="card" style="display:flex;flex-direction:column;gap:12px">
      <h2 style="font-size:18px">Tahmin dağılımı${tab === 'all' ? '' : ` · ${tab} harf`}</h2>
      ${src.played ? `
      <div class="dist">
        ${src.dist.map((c, i) => `
          <div class="dist-row"><span>${i + 1}</span>
            <span class="dist-bar ${lastDaily === i + 1 ? 'hl' : ''}" style="width:${Math.max(8, (c / max) * 100)}%">${c}</span>
          </div>`).join('')}
      </div>` : `<p class="muted" style="margin:0">${tab} harfli kelimelerle henüz oyun oynamadın.</p>`}
    </section>
    <button class="card tint tint-amber badge-summary" data-go="#/rozetler">
      <span class="dot amber">${icon('workspace_premium', 'fill')}</span>
      <div><strong>Rozetler</strong><small>${unlocked} / ${ACHIEVEMENTS.length} açıldı</small></div>
      ${icon('chevron_right')}
    </button>
    <section class="kv-grid">
      <div class="kv"><span class="dot primary">${icon('bolt')}</span><div><small>Toplam XP</small><strong>${fmt(p.xp)}</strong></div></div>
      <div class="kv"><span class="dot amber">${icon('paid')}</span><div><small>Coin</small><strong>${fmt(p.coins)}</strong></div></div>
      <div class="kv"><span class="dot mint">${icon('military_tech')}</span><div><small>Seviye</small><strong>${levelFor(p.xp)}</strong></div></div>
      <div class="kv"><span class="dot blue">${icon('trophy')}</span><div><small>Lig</small><strong>${leagueFor(p.xp)}</strong></div></div>
    </section>
    <p class="muted" style="margin:0">Uzunluğa göre sayılar bu özellik eklendikten sonra oynanan oyunları kapsar. "Tümü" sekmesi bütün oyunları gösterir.</p>
  </main>
  ${bottomNav('stats')}`;
  bindCommon();
  app.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => {
    statsTab = b.dataset.tab;
    const y = window.scrollY;
    runCleanups();
    renderStats();
    window.scrollTo(0, y);
  }));
}

// ---------- Rozetler ----------

function renderBadges() {
  const p = getProfile();
  const items = ACHIEVEMENTS.map((a) => ({ a, pr: achievementProgress(p, a) }));
  const unlocked = items.filter((x) => x.pr.unlockedAt);
  items.sort((x, y) => Number(!!y.pr.unlockedAt) - Number(!!x.pr.unlockedAt));
  app.innerHTML = `
  ${headerGame('Rozetler')}
  <main class="page">
    <section class="card tint tint-amber" style="display:flex;align-items:center;gap:14px">
      <span class="dot amber" style="width:52px;height:52px;border-radius:999px;display:flex;align-items:center;justify-content:center">${icon('workspace_premium', 'fill')}</span>
      <div><strong style="font-size:22px">${unlocked.length} / ${ACHIEVEMENTS.length}</strong><br><span class="muted">rozet açıldı. Her rozet coin ödülü verir.</span></div>
    </section>
    <div class="badge-grid">
      ${items.map(({ a, pr }) => `
        <div class="badge-tile ${pr.unlockedAt ? 'on' : ''}">
          <span class="badge-icon">${icon(pr.unlockedAt ? a.icon : 'lock', 'fill')}</span>
          <strong>${esc(a.title)}</strong>
          <small>${esc(a.desc)}</small>
          ${pr.unlockedAt
            ? `<span class="badge mint">${parseDay(pr.unlockedAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' })}</span>`
            : `<div class="bar"><span style="width:${(pr.cur / pr.goal) * 100}%"></span></div><span class="small muted">${pr.cur} / ${pr.goal} · +${a.reward} coin</span>`}
        </div>`).join('')}
    </div>
  </main>`;
  bindBack();
  bindCommon();
}

// ---------- Arşiv ----------

function renderArchive() {
  const today = dayKey();
  const days = archiveDays(today, EPOCH_DAY);
  const rows = days.map((d) => ({ d, rec: getDayRecord(d) }));
  const done = rows.filter((x) => x.rec?.finished).length;
  app.innerHTML = `
  ${headerGame('Arşiv')}
  <main class="page">
    <section class="card tint tint-sky" style="display:flex;flex-direction:column;gap:6px">
      <h2 style="font-size:20px">Geçmiş günlerin kelimeleri</h2>
      <p class="muted" style="margin:0">Kaçırdığın günlerin kelimelerini burada oynayabilirsin. Arşiv oyunları ödül ve istatistik kazandırır, ama seriyi etkilemez. Son ${days.length} günden ${done} tanesi tamamlandı.</p>
    </section>
    <div class="archive-list">
      ${rows.map(({ d, rec }) => {
        const st = rec?.finished ? (rec.won ? 'won' : 'lost') : rec?.guesses?.length ? 'open' : 'new';
        const label = { won: `${rec?.guesses?.length}/6 bildin`, lost: 'Kaçtı', open: 'Yarım kaldı', new: 'Oynanmadı' }[st];
        return `
        <button class="archive-row ${st}" data-go="#/oyna/arsiv/${d}">
          <span class="archive-date"><strong>${parseDay(d).getDate()}</strong><small>${parseDay(d).toLocaleDateString('tr-TR', { month: 'short' })}</small></span>
          <span class="archive-info"><strong>${parseDay(d).toLocaleDateString('tr-TR', { weekday: 'long' })}</strong><small>Kelime #${dayNumber(parseDay(d)) + 1}</small></span>
          <span class="badge ${st === 'won' ? 'mint' : st === 'lost' ? '' : st === 'open' ? 'amber' : 'primary'}">${label}</span>
        </button>`;
      }).join('')}
    </div>
  </main>`;
  bindBack();
  bindCommon();
}

// ---------- Profil ----------

function renderProfile() {
  const p = getProfile();
  const st = nameChangeStatus(p);
  const nameHint = st.free
    ? 'Adını ücretsiz değiştirebilirsin.'
    : `Ücretsiz değişiklik için ${st.gamesLeft} oyun daha oyna ya da ${fmt(st.cost)} coin öde. Bakiyen: ${fmt(p.coins)} coin.`;
  const nameButton = st.free
    ? `<button class="btn btn-soft" id="change-name">${icon('edit')}Değiştir</button>`
    : `<button class="btn btn-soft" id="change-name" ${st.canPay ? '' : 'disabled'}>${icon('paid')}${fmt(st.cost)} coin</button>`;
  const toggle = (id, label, desc, on, disabled = false) => `
    <div class="setting-row ${disabled ? 'disabled' : ''}">
      <div><label for="${id}">${label}</label><small>${desc}</small></div>
      <button class="switch" id="${id}" role="switch" aria-checked="${on}" ${disabled ? 'disabled' : ''}><span></span></button>
    </div>`;
  const canRemind = remindersSupported();
  app.innerHTML = `
  ${headerHome(p)}
  <main class="page">
    <h2 style="margin:0;font-size:28px;line-height:36px">Profil</h2>
    <section class="card" style="display:flex;flex-direction:column;gap:10px">
      <span class="small muted">OYUNCU ADI</span>
      <div class="name-row">
        <span class="avatar big">${esc(initials(p.name))}</span>
        <strong class="name-text">${esc(p.name)}</strong>
        ${nameButton}
      </div>
      <p class="muted" style="margin:0">${nameHint}</p>
    </section>
    <section class="card" style="display:flex;flex-direction:column;gap:12px">
      <h2 style="font-size:18px">Mağaza</h2>
      <div class="shop-row">
        <span class="dot primary">${icon('shield', 'fill')}</span>
        <div>
          <strong>Seri koruyucu · ${p.freezes}/${FREEZE_MAX}</strong>
          <small>Bir günü kaçırırsan serini korur, kendiliğinden kullanılır.</small>
        </div>
        <button class="btn btn-soft" id="buy-freeze" ${p.freezes >= FREEZE_MAX || p.coins < FREEZE_COST ? 'disabled' : ''}>${icon('paid')}${FREEZE_COST}</button>
      </div>
      <p class="muted small" style="margin:0">Bakiyen: ${fmt(p.coins)} coin</p>
    </section>
    <section class="card" style="display:flex;flex-direction:column;gap:16px">
      <h2 style="font-size:18px">Ayarlar</h2>
      ${toggle('sound-toggle', 'Oyun sesleri', 'Tuş, kazanma ve kaybetme sesleri', p.sound)}
      ${toggle('haptics-toggle', 'Titreşim', 'Harflere basınca hafif titreşim', p.haptics)}
      ${toggle('hard-toggle', 'Zor mod', 'Bulunan harfleri sonraki tahminlerde kullanmak zorunlu. Yeni oyunlardan itibaren geçerli.', p.hardMode)}
      ${toggle('reminder-toggle', 'Günlük hatırlatma', canRemind ? 'Günün kelimesini çözmediysen seçtiğin saatte bildirim gelir.' : 'Yalnızca Android uygulamasında çalışır.', p.reminder && canRemind, !canRemind)}
      ${canRemind && p.reminder ? `
      <div class="setting-row">
        <div><label for="reminder-time">Hatırlatma saati</label></div>
        <select class="select" id="reminder-time">
          ${REMINDER_TIMES.map((t) => `<option value="${t}" ${t === p.reminderTime ? 'selected' : ''}>${t}</option>`).join('')}
        </select>
      </div>` : ''}
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
        <li>Kelimenin ilk harfi baştan açıktır. Kalan harfleri 6 denemede bul.</li>
        <li>Kelime uzunluğunu ana sayfadan seç: 4 ile 9 harf arası. Günün kelimesi her zaman ${DAILY_LENGTH} harflidir.</li>
        <li><b style="color:var(--correct-ink)">Yeşil</b>: harf doğru yerde. Bu harfler sonraki satırda da gösterilir.</li>
        <li><b style="color:var(--present-ink)">Turuncu</b>: harf kelimede var ama başka yerde.</li>
        <li><b>Mavi-gri</b>: harf kelimede yok.</li>
        <li>Tahminler TDK Güncel Türkçe Sözlük'teki kelimelerden olmalı.</li>
        <li>İpucu 4. tahminde açılır. Bir kelimede en fazla ${HINT_MAX} ipucu alınır; ilki bedava, sonrakiler ${HINT_COST} coin. Son bilinmeyen harf ipucuyla açılmaz.</li>
        <li>Oyuncu adını her ${NAME_FREE_AFTER_GAMES} oyunda bir ücretsiz değiştirebilirsin; beklemek istemezsen coin ödersin.</li>
        <li>Seri koruyucu, kaçırdığın bir günü kendiliğinden kapatır. En fazla ${FREEZE_MAX} tane taşıyabilirsin.</li>
        <li>Zor modda yeşil harfler yerinde kalmalı, turuncu harfler tahminde kullanılmalı.</li>
      </ul>
    </section>
    <button class="btn btn-ghost" id="reset" style="color:var(--danger)">${icon('delete')}Tüm verileri sıfırla</button>
  </main>
  ${bottomNav('profile')}`;

  bindCommon();
  app.querySelector('#change-name').addEventListener('click', changeName);
  for (const [id, key] of [['sound-toggle', 'sound'], ['haptics-toggle', 'haptics'], ['hard-toggle', 'hardMode']]) {
    app.querySelector(`#${id}`).addEventListener('click', (e) => {
      const on = !getProfile()[key];
      updateProfile({ [key]: on });
      e.currentTarget.setAttribute('aria-checked', String(on));
      if (on && key !== 'hardMode') feedback.preview(key);
      if (key === 'hardMode') toast(on ? 'Zor mod açık. Yeni oyunlarda geçerli.' : 'Zor mod kapalı');
    });
  }
  app.querySelector('#reminder-toggle')?.addEventListener('click', async () => {
    const on = !getProfile().reminder;
    if (on && !(await requestReminderPermission())) {
      toast('Bildirim izni verilmedi. Telefon ayarlarından açabilirsin.', 3000);
      return;
    }
    updateProfile({ reminder: on });
    await refreshReminders();
    toast(on ? `Her gün ${getProfile().reminderTime} için hatırlatma kuruldu` : 'Hatırlatma kapatıldı');
    render();
  });
  app.querySelector('#reminder-time')?.addEventListener('change', async (e) => {
    updateProfile({ reminderTime: e.target.value });
    await refreshReminders();
    toast(`Hatırlatma saati ${e.target.value}`);
  });
  app.querySelector('#buy-freeze').addEventListener('click', () => {
    const r = buyFreeze();
    if (!r.ok) return toast(r.reason);
    feedback.hint();
    toast('Seri koruyucu alındı');
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
  arsiv: renderArchive,
  rozetler: renderBadges,
  istatistik: renderStats,
  profil: renderProfile,
};

function render() {
  runCleanups();
  renderToken++;
  const path = location.hash.replace(/^#\/?/, '');
  const archiveMatch = path.match(/^oyna\/arsiv\/(\d{4}-\d{2}-\d{2})$/);
  const view = archiveMatch ? () => renderGame('archive', archiveMatch[1]) : routes[path] || renderHome;
  session = null;
  checkStreak();
  window.scrollTo(0, 0);
  view();
  ensureName();
}

// Kaçırılan günler seri koruyucuyla kapatılır ya da seri kırılır; oyuncuya bir kez söylenir.
function checkStreak() {
  const r = applyStreakFreezes();
  if (!r) return;
  if (r.used.length) toast(`${r.used.length} seri koruyucu kullanıldı, serin devam ediyor`, 3200);
  else if (r.broken) toast('Serin sona erdi. Bugün yeni bir seri başlat!', 3200);
  refreshReminders();
}

async function refreshReminders() {
  const p = getProfile();
  await syncReminders({
    enabled: p.reminder,
    time: p.reminderTime,
    streak: currentStreak(),
    playedToday: !!getDayRecord(dayKey())?.finished,
  });
}

applyTheme(getProfile().theme);
window.addEventListener('hashchange', render);
render();
refreshReminders();
