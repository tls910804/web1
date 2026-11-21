import { tt } from '../i18n';
import { DAY, MODES } from '../constants';
import type { AppState, ModeKey, Rate, SavedItem } from '../types';
import { dayKey, startOfDay } from './text';

export function interval(mode: ModeKey, step: number) {
  const d = MODES[mode].days, last = d.length - 1;
  if (step <= last) return d[Math.max(step, 0)];
  return Math.min(d[last] * Math.pow(2, step - last), 120);
}

export const daysLabel = (n: number) => (n === 1 ? tt('내일') : tt('{n}일 뒤', { n }));

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
  return days <= 1 ? tt('내일 {n}개를 복습해요', { n }) : tt('{d}일 뒤 {n}개를 복습해요', { d: days, n });
}

/** 틀린 문장은 이만큼 뒤에 다시 복습에 나온다 */
export const RETRY = 5 * 60_000;
export const retryItems = (s: AppState, now = Date.now()) =>
  s.saved.filter((x) => !x.learned && x.due > now && x.due - now <= RETRY);

/** '다시'를 이만큼 받으면 약점으로 본다 */
export const WEAK_AT = 2;
/** 오답 노트에서 이만큼 연속으로 맞히면 졸업 */
export const GRAD_AT = 3;
export const isWeak = (x: SavedItem) => !x.learned && (x.lapses || 0) >= WEAK_AT;
/** 평가 뒤 틀린 횟수(lapses)와 오답 노트 연속 맞힘(okRun). 오답 노트 문장은 GRAD_AT번 연속 맞혀야 졸업(grad)해요 */
export function wrongNote(x: SavedItem, r: Rate) {
  const lapses = x.lapses || 0;
  if (r === 'again') return { lapses: lapses + 1, okRun: 0, grad: false };
  if (!isWeak(x)) return { lapses: r === 'hard' ? lapses : Math.max(0, lapses - 1), okRun: 0, grad: false };
  const run = (x.okRun || 0) + 1;
  return run >= GRAD_AT ? { lapses: 0, okRun: 0, grad: true } : { lapses, okRun: run, grad: false };
}
export const weakItems = (s: AppState) => s.saved.filter(isWeak);
/** 오늘 복습 목록 중 약점이 몇 개인지 */
export const weakInToday = (s: AppState) => dueItems(s).slice(0, s.daily).filter(isWeak).length;
export const minutesFor = (n: number) => Math.max(1, Math.ceil(n / 3));

type Log = AppState['log'][string];
/** 그날 한 일의 양: 복습 + 자동 공부 문장 + AI 전화 */
export const amount = (e?: Log) => (e ? e.n + (e.s || 0) + (e.c || 0) : 0);
const weekOf = (t: number) => { const d = startOfDay(t); return d - ((new Date(d).getDay() + 6) % 7) * DAY; };

/** 연속 기록: 하루라도 뭔가 한 날이 이어진 일수 (오늘 아직 안 했으면 어제까지).
 *  쉬는 날 지키기: 한 주(월~일)에 한 번, 앞뒤로 공부한 사이의 하루 빈 날은 끊기지 않게 메워요(그날은 세지 않아요). */
export function streakInfo(log: AppState['log'], now = Date.now()) {
  let n = 0;
  const frozen: number[] = [];
  for (let i = amount(log[dayKey(now)]) ? 0 : 1; i < 400; i++) {
    const t = startOfDay(now - i * DAY);
    if (amount(log[dayKey(t)])) { n++; continue; }
    const free = !frozen.some((f) => weekOf(f) === weekOf(t));
    if (free && amount(log[dayKey(t - DAY)])) { frozen.push(t); continue; }
    break;
  }
  return { n, frozen, left: frozen.some((f) => weekOf(f) === weekOf(now)) ? 0 : 1 };
}
export const streakOf = (log: AppState['log']) => streakInfo(log).n;
