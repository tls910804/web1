import { DAY, MODES } from '../constants';
import type { AppState, ModeKey, Rate, SavedItem } from '../types';
import { startOfDay } from './text';

export function interval(mode: ModeKey, step: number) {
  const d = MODES[mode].days, last = d.length - 1;
  if (step <= last) return d[Math.max(step, 0)];
  return Math.min(d[last] * Math.pow(2, step - last), 120);
}

export const daysLabel = (n: number) => (n === 1 ? '내일' : `${n}일 뒤`);

// 평가별 다음 단계와 간격
export function rateResult(mode: ModeKey, item: SavedItem, r: Rate) {
  const s = item.step || 0;
  if (r === 'again') return { step: 0, days: 1 };
  if (r === 'hard') return { step: Math.max(s, 1), days: interval(mode, s) };
  if (r === 'good') return { step: s + 1, days: interval(mode, s + 1) };
  return { step: s + 2, days: interval(mode, s + 2) };
}

export const dueItems = (s: AppState) => {
  const now = Date.now();
  return s.saved.filter((x) => !x.learned && x.due <= now).sort((a, b) => a.due - b.due);
};
export const todayCount = (s: AppState) => Math.min(dueItems(s).length, s.daily);
export const mastered = (x: SavedItem) => x.learned || (x.step || 0) >= 3;

export function nextDueText(s: AppState) {
  const next = s.saved.filter((x) => !x.learned).map((x) => x.due).sort((a, b) => a - b)[0];
  if (!next) return '';
  const days = Math.round((startOfDay(next) - startOfDay(Date.now())) / DAY);
  const n = s.saved.filter((x) => !x.learned && startOfDay(x.due) === startOfDay(next)).length;
  return `${days <= 1 ? '내일' : days + '일 뒤'} ${n}개를 복습해요`;
}

/** '다시'를 이만큼 받으면 약점으로 본다 */
export const WEAK_AT = 2;
export const isWeak = (x: SavedItem) => !x.learned && (x.lapses || 0) >= WEAK_AT;
export const weakItems = (s: AppState) => s.saved.filter(isWeak);
/** 오늘 복습 목록 중 약점이 몇 개인지 */
export const weakInToday = (s: AppState) => dueItems(s).slice(0, s.daily).filter(isWeak).length;
export const minutesFor = (n: number) => Math.max(1, Math.ceil(n / 3));
