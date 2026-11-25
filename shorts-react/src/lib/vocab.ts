// 단어장 학습 규칙: 틀리면 처음 칸, 맞히면 한 칸씩 올라가고 칸이 높을수록 늦게 다시 나온다.
/** 단어별 기록 [칸(1~5), 다음에 볼 시각] */
export type VocabLog = Record<string, [number, number]>;
export type Step = { w: number; kind: 'intro' | 'meaning' | 'word' | 'type' };

const GAP = [0, 1, 3, 7, 14, 30]; // 칸별 다음 복습까지 일수
export const SESSION = 10;

export const nextBox = (box: number, missed: boolean) => (missed ? 1 : Math.min(5, box + 1));
export const dueAt = (box: number, now: number) => new Date(now).setHours(0, 0, 0, 0) + GAP[box] * 86400000;

/** 오늘 볼 단어 번호: 복습할 때가 된 것 먼저, 남는 자리는 새 단어 */
export function pickSession(keys: string[], log: VocabLog, now: number, size = SESSION): number[] {
  const ids = keys.map((_, i) => i);
  const due = ids.filter((i) => log[keys[i]] && log[keys[i]][1] <= now).sort((a, b) => log[keys[a]][1] - log[keys[b]][1]);
  const fresh = ids.filter((i) => !log[keys[i]]);
  return [...due, ...fresh].slice(0, size);
}

/** 새 단어는 두 개씩 보여주고 바로 뜻 고르기, 맨 뒤에 단어 떠올리기. 복습은 칸이 높으면 직접 쓰기 */
export function buildSteps(ids: number[], boxOf: (i: number) => number): Step[] {
  const fresh = ids.filter((i) => !boxOf(i));
  const steps: Step[] = ids.filter((i) => boxOf(i)).map((w) => ({ w, kind: boxOf(w) >= 3 ? 'type' : 'word' }));
  for (let i = 0; i < fresh.length; i += 2) {
    const pair = fresh.slice(i, i + 2);
    steps.push(...pair.map((w): Step => ({ w, kind: 'intro' })), ...pair.map((w): Step => ({ w, kind: 'meaning' })));
  }
  steps.push(...fresh.map((w): Step => ({ w, kind: 'word' })));
  return steps;
}
