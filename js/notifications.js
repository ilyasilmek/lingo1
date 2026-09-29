// Günlük hatırlatma bildirimleri. Yalnızca Android uygulamasında çalışır
// (Capacitor Local Notifications); tarayıcıda hiçbir şey yapmaz.
import { reminderSchedule, REMINDER_IDS } from './progress.js';

function plugin() {
  const cap = window.Capacitor;
  return cap?.isNativePlatform?.() ? cap.Plugins?.LocalNotifications : null;
}

export function remindersSupported() {
  return !!plugin();
}

// İzin ister. Verildiyse true.
export async function requestReminderPermission() {
  const ln = plugin();
  if (!ln) return false;
  try {
    let st = await ln.checkPermissions();
    if (st.display !== 'granted') st = await ln.requestPermissions();
    return st.display === 'granted';
  } catch {
    return false;
  }
}

// Mevcut hatırlatmaları silip ayarlara göre yeniden kurar.
export async function syncReminders({ enabled, time, streak, playedToday }) {
  const ln = plugin();
  if (!ln) return;
  try {
    await ln.cancel({ notifications: REMINDER_IDS.map((id) => ({ id })) });
    if (!enabled) return;
    const list = reminderSchedule({ time, streak, playedToday });
    await ln.schedule({
      notifications: list.map((n) => ({
        id: n.id,
        title: n.title,
        body: n.body,
        schedule: { at: n.at, allowWhileIdle: true },
        isExactNotification: false,
        smallIcon: 'ic_stat_lingo',
        iconColor: '#FF8A4C',
      })),
    });
  } catch {
    // Bildirim kurulamazsa oyun etkilenmez.
  }
}
