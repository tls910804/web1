import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildSteps, cloze, hintShape, knownLog, placementIds, why, dueAt, nextBox, pickSession } from './vocab.ts';

const now = new Date(2026, 0, 10, 15).getTime();
assert.equal(nextBox(0, false), 1);
assert.equal(nextBox(4, true), 1);
assert.equal(nextBox(5, false), 5);
assert.equal(dueAt(1, now), new Date(2026, 0, 11).getTime());
// 복습할 것이 먼저, 아직 때가 안 된 것은 빠진다
assert.deepEqual(pickSession(['a', 'b', 'c', 'd'], { c: [1, now - 1], b: [2, now + 1e9] }, now, 3), [2, 0, 3]);
const steps = buildSteps([0, 1, 2], (i) => (i === 0 ? 3 : 0));
assert.deepEqual(steps.map((s) => s.kind), ['cloze', 'intro', 'cloze', 'intro', 'cloze']);
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
