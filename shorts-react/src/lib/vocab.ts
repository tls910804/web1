// 단어장 학습 규칙: 틀리면 처음 칸, 맞히면 한 칸씩 올라가고 칸이 높을수록 늦게 다시 나온다.
/** 단어별 기록 [칸(1~5), 다음에 볼 시각] */
export type VocabLog = Record<string, [number, number]>;
export type Step = { w: number; kind: 'intro' | 'choose' | 'cloze' };

const GAP = [0, 1, 3, 7, 14, 30]; // 칸별 다음 복습까지 일수
export const SESSION = 20;
/** '이미 알아요'로 뺀 단어의 칸. 다시 나오지 않아요 */
export const KNOWN = 9;
export const knownLog = (): [number, number] => [KNOWN, 8.64e15];

export const nextBox = (box: number, missed: boolean) => (missed ? 1 : Math.min(5, box + 1));
export const dueAt = (box: number, now: number) => new Date(now).setHours(0, 0, 0, 0) + GAP[box] * 86400000;

/** 오늘 볼 단어 번호: 복습할 때가 된 것 먼저, 남는 자리는 새 단어 */
export function pickSession(keys: string[], log: VocabLog, now: number, size = SESSION, only = (_i: number) => true, maxNew = Infinity): number[] {
  const ids = keys.map((_, i) => i).filter(only);
  const due = ids.filter((i) => log[keys[i]] && log[keys[i]][0] !== KNOWN && log[keys[i]][1] <= now).sort((a, b) => log[keys[a]][1] - log[keys[b]][1]);
  const fresh = ids.filter((i) => !log[keys[i]]).slice(0, maxNew);
  // 복습이 많아도 새 단어 몇 개(최대 5)는 늘 자리를 남겨 둬요
  const keep = Math.min(fresh.length, 5, size);
  return [...due.slice(0, size - keep), ...fresh].slice(0, size);
}

/** 단어마다 빈칸 한 번. 새 단어는 보기 → 뜻 고르기 → 빈칸 (알아보기 다음에 떠올리기) */
export function buildSteps(ids: number[], boxOf: (i: number) => number): Step[] {
  return ids.flatMap((w): Step[] => (boxOf(w) ? [{ w, kind: 'cloze' }] : [{ w, kind: 'intro' }, { w, kind: 'choose' }, { w, kind: 'cloze' }]));
}

/** 예문을 [빈칸 앞, 정답, 뒤]로 나눈다. 영어는 단어 전체만, 한국어는 뒤에 조사가 붙어도 돼요 */
export function cloze(example: string, form: string, whole: boolean): [string, string, string] | null {
  const esc = form.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = new RegExp(`(^|[^\\p{L}])(${esc})${whole ? '(?!\\p{L})' : ''}`, 'iu').exec(example);
  // 한국어는 '어젯밤', '첫눈'처럼 앞에 붙은 말도 있어요
  const at = m ? m.index + m[1].length : whole ? -1 : example.indexOf(form);
  if (at < 0) return null;
  return [example.slice(0, at), example.slice(at, at + form.length), example.slice(at + form.length)];
}

export type Why = 'form' | 'short' | 'long' | 'close' | 'other';
/** 고칠 곳 하나. miss: 정답의 a번째 글자를 빠뜨림(내 답 t번째 앞), extra: 내 답 t번째가 남음, swap: 내 답 t번째를 정답 a번째로 */
export type Op = { k: 'miss' | 'extra' | 'swap'; t: number; a: number };

/** 틀린 답이 정답과 어떻게 다른지: 실수 종류와 고칠 곳들 */
export function why(typed: string, answer: string, base: string) {
  const t = typed.trim().toLowerCase(), a = answer.toLowerCase();
  const ops = edits(t, a);
  const kind: Why = t === base.toLowerCase() && t !== a ? 'form'
    : a.startsWith(t) ? 'short'
    : t.startsWith(a) ? 'long'
    : ops.length <= Math.max(1, Math.floor(a.length / 4)) ? 'close' : 'other';
  return { kind, ops };
}

/** 글자를 가장 적게 고쳐서 같게 만드는 방법(넣기·빼기·바꾸기) */
function edits(x: string, y: string): Op[] {
  const d = [...Array(x.length + 1)].map((_, i) => [...Array(y.length + 1)].map((_, j) => (i ? (j ? 0 : i) : j)));
  for (let i = 1; i <= x.length; i++)
    for (let j = 1; j <= y.length; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (x[i - 1] === y[j - 1] ? 0 : 1));
  const ops: Op[] = [];
  let i = x.length, j = y.length;
  while (i || j) {
    if (i && j && x[i - 1] === y[j - 1] && d[i][j] === d[i - 1][j - 1]) { i--; j--; }
    else if (i && j && d[i][j] === d[i - 1][j - 1] + 1) ops.unshift({ k: 'swap', t: --i, a: --j });
    else if (i && d[i][j] === d[i - 1][j] + 1) ops.unshift({ k: 'extra', t: --i, a: j });
    else ops.unshift({ k: 'miss', t: i, a: --j });
  }
  return ops;
}

/** 수준 테스트에 낼 단어: 아직 기록 없는 단어 중 앞에서 뒤까지 고르게 count개 */
export function placementIds(keys: string[], log: VocabLog, count = 20): number[] {
  const fresh = keys.map((_, i) => i).filter((i) => !log[keys[i]]);
  if (fresh.length <= count) return fresh;
  return [...Array(count)].map((_, k) => fresh[Math.floor((k * fresh.length) / count)]);
}

/** 힌트 모양: 5글자 이상은 앞 2글자와 끝 글자, 3~4글자는 첫 글자만, 나머지는 점 */
export function hintShape(answer: string) {
  const c = [...answer], n = c.length;
  const show = n >= 5 ? [0, 1, n - 1] : n >= 3 ? [0] : [];
  return c.map((ch, i) => (show.includes(i) || ch === ' ' ? ch : '·')).join('');
}

/** 오늘 공부한 단어 수. 다음 복습일이 '오늘 + 칸 간격'이면 오늘 본 단어예요 (따로 저장하지 않아요) */
export const todayCount = (log: VocabLog, now: number) =>
  Object.entries(log).filter(([k, [box, at]]) => !k.includes('#') && box !== KNOWN && at === dueAt(box, now)).length;

/** 공부한 날 표시 (text.ts의 dayKey와 같은 모양) */
export const dayOf = (t: number) => { const d = new Date(t); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
const back = (t: number, n: number) => { const d = new Date(t); d.setDate(d.getDate() - n); return d.getTime(); };

/** 연속 공부일. 하루 쉬는 건 괜찮고 이틀 연속 쉬면 끊겨요. 오늘 아직 안 했어도 어제까지 이어져 있으면 그대로 */
export function dayStreak(days: string[], now: number) {
  const has = new Set(days);
  let n = 0, miss = 0;
  for (let i = 0; i < 1000; i++) {
    if (has.has(dayOf(back(now, i)))) { n++; miss = 0; continue; }
    if (i === 0) continue;
    if (++miss > 1) break;
  }
  return n;
}

/** 이번 주 월~일 공부한 날 */
export function weekOf(days: string[], now: number) {
  const has = new Set(days), mon = back(now, (new Date(now).getDay() + 6) % 7);
  return [0, 1, 2, 3, 4, 5, 6].map((k) => has.has(dayOf(back(mon, -k))));
}

/** 무료 새 단어: 처음 30개, 그다음은 하루 5개 (복습은 언제나 무료). 프리미엄이면 제한 없음 */
export const FREE_START = 30, FREE_DAILY = 5;
/** n: 지금까지 배운 새 단어 수, day/today: 마지막으로 배운 날과 그날 개수, done: 처음 30개를 다 채운 날 */
export type Free = { n: number; day: string; today: number; done: string };
export const NO_FREE: Free = { n: 0, day: '', today: 0, done: '' };

/** 오늘 무료로 더 배울 수 있는 새 단어 수. 30개를 채운 날은 0, 다음 날부터 5개 (모아 두지 않아요) */
export function freeLeft(f: Free, today: string) {
  if (f.n < FREE_START) return FREE_START - f.n;
  if (f.done === today) return 0;
  return Math.max(0, FREE_DAILY - (f.day === today ? f.today : 0));
}

/** 새 단어 하나를 배웠을 때 */
export function spendFree(f: Free, today: string): Free {
  const n = f.n + 1;
  return { n, day: today, today: f.day === today ? f.today + 1 : 1, done: n === FREE_START ? today : f.done };
}
