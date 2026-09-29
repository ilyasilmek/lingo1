// Ses ve titreşim geri bildirimi. Ayarlar profilde tutulur (sound, haptics).
// Sesler dosyadan çalınmaz, Web Audio ile anında üretilir: lisans gerektirmez, uygulamayı büyütmez.
import { getProfile } from './storage.js';

let ctx = null;
let master = null;

function audio() {
  if (!getProfile().sound) return null;
  try {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
    }
    // Tarayıcılar sesi ancak bir dokunuştan sonra açar; her çağrıda uyandırmayı dener.
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

// Tek bir ton: frekans (Hz), başlangıç gecikmesi ve süre (sn), dalga tipi, ses düzeyi.
function tone(freq, { at = 0, dur = 0.12, type = 'sine', gain = 0.3, slide = 0 } = {}) {
  const c = audio();
  if (!c) return;
  const t = c.currentTime + at;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(master);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

// Android'de Capacitor'ın yerel titreşim eklentisi, tarayıcıda Vibration API kullanılır.
function nativeHaptics() {
  const cap = window.Capacitor;
  return cap?.isNativePlatform?.() ? cap.Plugins?.Haptics : null;
}

function haptic(kind) {
  if (!getProfile().haptics) return;
  const native = nativeHaptics();
  try {
    if (native) {
      if (kind === 'tap') native.impact({ style: 'LIGHT' });
      else if (kind === 'press') native.impact({ style: 'MEDIUM' });
      else if (kind === 'success') native.notification({ type: 'SUCCESS' });
      else if (kind === 'error') native.notification({ type: 'ERROR' });
      else if (kind === 'warning') native.notification({ type: 'WARNING' });
      return;
    }
    if (!navigator.vibrate) return;
    const patterns = { tap: 8, press: 18, success: [30, 60, 30, 60, 60], error: [60, 50, 60], warning: [40, 40, 40] };
    navigator.vibrate(patterns[kind] ?? 10);
  } catch {
    // Titreşim desteklenmiyorsa sessizce geç.
  }
}

// Harf renkleri döndükçe çalınan kısa sesler: yeşil yüksek, turuncu orta, gri alçak.
const REVEAL_PITCH = { correct: 880, present: 660, absent: 330 };

export const feedback = {
  key() {
    tone(620, { dur: 0.045, type: 'triangle', gain: 0.18 });
    haptic('tap');
  },
  erase() {
    tone(420, { dur: 0.05, type: 'triangle', gain: 0.14 });
    haptic('tap');
  },
  submit() {
    haptic('press');
  },
  invalid() {
    tone(180, { dur: 0.09, type: 'square', gain: 0.12 });
    tone(150, { at: 0.1, dur: 0.12, type: 'square', gain: 0.12 });
    haptic('error');
  },
  reveal(state, index, stepMs) {
    tone(REVEAL_PITCH[state] || 440, { at: (index * stepMs) / 1000 + 0.28, dur: 0.09, type: 'sine', gain: 0.16 });
  },
  hint() {
    tone(990, { dur: 0.08, gain: 0.18 });
    tone(1320, { at: 0.07, dur: 0.12, gain: 0.16 });
    haptic('tap');
  },
  win() {
    [523, 659, 784, 1047].forEach((f, i) => tone(f, { at: i * 0.11, dur: 0.22, type: 'triangle', gain: 0.26 }));
    tone(1568, { at: 0.46, dur: 0.4, type: 'sine', gain: 0.18 });
    haptic('success');
  },
  lose() {
    [392, 349, 311].forEach((f, i) => tone(f, { at: i * 0.18, dur: 0.26, type: 'sawtooth', gain: 0.1 }));
    tone(262, { at: 0.54, dur: 0.55, type: 'triangle', gain: 0.2, slide: -60 });
    haptic('warning');
  },
  tick() {
    tone(1100, { dur: 0.03, type: 'square', gain: 0.06 });
  },
  timeUp() {
    tone(440, { dur: 0.18, type: 'square', gain: 0.14 });
    tone(330, { at: 0.2, dur: 0.35, type: 'square', gain: 0.14 });
    haptic('warning');
  },
  // Ayarlarda açılınca örnek olarak çalınır.
  preview(kind) {
    if (kind === 'sound') this.win();
    else haptic('success');
  },
};
