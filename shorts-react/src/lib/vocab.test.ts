import assert from 'node:assert/strict';
import { buildSteps, dueAt, nextBox, pickSession } from './vocab.ts';

const now = new Date(2026, 0, 10, 15).getTime();
assert.equal(nextBox(0, false), 1);
assert.equal(nextBox(4, true), 1);
assert.equal(nextBox(5, false), 5);
assert.equal(dueAt(1, now), new Date(2026, 0, 11).getTime());
// 복습할 것이 먼저, 아직 때가 안 된 것은 빠진다
assert.deepEqual(pickSession(['a', 'b', 'c', 'd'], { c: [1, now - 1], b: [2, now + 1e9] }, now, 3), [2, 0, 3]);
const steps = buildSteps([0, 1, 2], (i) => (i === 0 ? 3 : 0));
assert.deepEqual(steps.map((s) => s.kind), ['type', 'intro', 'intro', 'meaning', 'meaning', 'word', 'word']);
console.log('ok vocab');
