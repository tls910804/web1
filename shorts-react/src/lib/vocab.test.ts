import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildSteps, cloze, hintShape, knownLog, placementIds, why, dueAt, nextBox, pickSession, todayCount, dayStreak, weekOf, dayOf, freeLeft } from './vocab.ts';

const now = new Date(2026, 0, 10, 15).getTime();
assert.equal(nextBox(0, false), 1);
assert.equal(nextBox(4, true), 1);
assert.equal(nextBox(5, false), 5);
assert.equal(dueAt(1, now), new Date(2026, 0, 11).getTime());
// 복습할 것이 먼저, 아직 때가 안 된 것은 빠진다
assert.deepEqual(pickSession(['a', 'b', 'c', 'd'], { c: [1, now - 1], b: [2, now + 1e9] }, now, 3), [2, 0, 3]);
const steps = buildSteps([0, 1, 2], (i) => (i === 0 ? 3 : 0));
assert.deepEqual(steps.map((s) => s.kind), ['cloze', 'choose', 'choose']);
assert.deepEqual(cloze('He never complains about work.', 'complains', true), ['He never ', 'complains', ' about work.']);
// 모든 단어는 예문에 빈칸을 만들 수 있어야 해요
const book = JSON.parse(readFileSync(new URL('../data/words.json', import.meta.url), 'utf8')) as Record<string, string[][]>;
for (const [code, list] of Object.entries(book)) for (const w of list) assert.ok(cloze(w[2], w[4] ?? w[0], code === 'en'), `${code} ${w[0]}`);
assert.equal(why('complain', 'complains', 'complain').kind, 'form');
assert.equal(why('appoint', 'appointment', 'appointment').kind, 'short');
assert.deepEqual(why('apointment', 'appointment', 'appointment'), { kind: 'close', ops: [{ k: 'miss', t: 1, a: 1 }] });
assert.deepEqual(why('availible', 'available', 'available').ops, [{ k: 'swap', t: 5, a: 5 }]);
assert.deepEqual(why('appointtment', 'appointment', 'appointment').ops, [{ k: 'extra', t: 6, a: 6 }]);
assert.equal(why('table', 'appointment', 'appointment').kind, 'other');
// 아는 단어는 빠지고, 주제 밖 단어도 빠진다
assert.deepEqual(pickSession(['a', 'b', 'c'], { a: knownLog() }, now), [1, 2]);
assert.deepEqual(pickSession(['a', 'b', 'c'], {}, now, 20, (i) => i !== 1), [0, 2]);
assert.deepEqual(placementIds(['a', 'b', 'c', 'd', 'e', 'f'], { b: [1, 0] }, 3), [0, 2, 4]);
assert.equal(hintShape('appointment'), 'ap········t');
assert.equal(hintShape('가요'), '··');
console.log('ok vocab');

// 오늘 본 단어만 세요 (아는 단어·수준 테스트 표시·지난 기록은 빼고)
{
  const now = new Date(2026, 10, 26, 15).getTime();
  const log = { 'en:a': [1, dueAt(1, now)], 'en:b': [2, dueAt(2, now)], 'en:c': [1, dueAt(1, now - 86400000)], 'en:d': knownLog(), 'en#start': [0, dueAt(0, now)] } as Record<string, [number, number]>;
  assert.equal(todayCount(log, now), 2);
}

// 연속: 하루 쉬어도 이어지고 이틀 쉬면 끊겨요. 이번 주 칸은 월요일부터
{
  const now = new Date(2026, 10, 26, 15).getTime(); // 목요일
  const d = (n: number) => dayOf(now - n * 86400000);
  assert.equal(dayStreak([d(0), d(1), d(3), d(4)], now), 4);
  assert.equal(dayStreak([d(1), d(2)], now), 2);
  assert.equal(dayStreak([d(0), d(3)], now), 1);
  assert.equal(dayStreak([], now), 0);
  assert.deepEqual(weekOf([d(0), d(3)], now), [true, false, false, true, false, false, false]);
}

// 무료: 모두 30개, 하루 제한 없음
{
  assert.equal(freeLeft(0), 30);
  assert.equal(freeLeft(25), 5);
  assert.equal(freeLeft(31), 0);
// 새 단어는 한도까지만, 복습은 그대로
  assert.deepEqual(pickSession(['a', 'b', 'c', 'd'], { a: [1, 0] }, 1, 20, undefined, 2), [0, 1, 2]);
}

// 복습이 한 판보다 많아도 새 단어 5개 자리는 남아요
{
  const keys = [...Array(30)].map((_, i) => 'k' + i);
  const log = Object.fromEntries(keys.slice(0, 25).map((k) => [k, [1, 0] as [number, number]]));
  const q = pickSession(keys, log, 1, 20);
  assert.equal(q.length, 20);
  assert.equal(q.filter((i) => i >= 25).length, 5);
}
