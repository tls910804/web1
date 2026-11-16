// 실행: node --experimental-strip-types src/lib/story.test.ts
import assert from 'node:assert/strict';
import { lineToCard } from './story.ts';
const s = { id: 'x', lang: 'en', level: '초급', cat: '일상', title: {} };
let c = lineToCard(s, { t: "Hey! Sorry I'm [running late]." }, 0);
assert.deepEqual(c.words, ['Hey!', 'Sorry', "I'm", 'running late.']); assert.deepEqual(c.key, [3]); assert.equal(c.expr, 'running late');
c = lineToCard(s, { t: '[Счёт], пожалуйста.' }, 1);
assert.deepEqual(c.words, ['Счёт,', 'пожалуйста.']); assert.deepEqual(c.key, [0]);
c = lineToCard({ ...s, lang: 'ja' }, { t: 'これ、|[温めて]|ください。' }, 2);
assert.deepEqual(c.words, ['これ、', '温めて', 'ください。']); assert.deepEqual(c.key, [1]);
c = lineToCard(s, { t: '¡Buenos días! ¿[Cuánto cuestan] las manzanas?' }, 3);
assert.deepEqual(c.words, ['¡Buenos', 'días!', '¿Cuánto cuestan', 'las', 'manzanas?']); 
console.log('ok', c.key);
