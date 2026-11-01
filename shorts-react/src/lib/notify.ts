import { DAY } from '../constants';
import type { AppState } from '../types';
import { allCards } from './feed';
import { todayCount } from './srs';
import { sentence, startOfDay, todayKey, trOf } from './text';

export const notifPerm = (): NotificationPermission | 'unsupported' => ('Notification' in window ? Notification.permission : 'unsupported');

export function notifySummary(s: AppState) {
  const p = notifPerm();
  if (p === 'denied' || p === 'unsupported') return '꺼짐';
  if (s.notify.morning && s.notify.evening) return '아침 · 저녁';
  if (s.notify.morning) return '매일 오전 8:00';
  if (s.notify.evening) return '매일 오후 8:00';
  return '꺼짐';
}

/** 알림 시각이 지난 뒤 앱을 열었을 때 한 번만 띄운다. 새로 기록할 값을 돌려준다. */
export function dueNotifications(s: AppState): AppState['notified'] | null {
  if (notifPerm() !== 'granted') return null;
  const now = new Date(), k = todayKey();
  const notified = { ...s.notified };
  try {
    if (s.notify.morning && now.getHours() >= 8 && notified.m !== k) {
      const cards = allCards(s);
      const c = cards[Math.floor(startOfDay(Date.now()) / DAY) % cards.length];
      if (c) new Notification('오늘의 한 문장', { body: `${sentence(c)}\n${trOf(c.tr, s.native)}`, tag: 'daily' });
      notified.m = k;
    }
    if (s.notify.evening && now.getHours() >= 20 && notified.e !== k && todayCount(s)) {
      new Notification(`복습할 문장이 ${todayCount(s)}개 있어요`, { body: '오늘 복습하면 연속 기록을 이어 갈 수 있어요', tag: 'review' });
      notified.e = k;
    }
  } catch { /* 모바일 크롬은 페이지에서 바로 알림을 띄우지 못한다 */ }
  return notified;
}
