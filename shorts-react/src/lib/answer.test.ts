// 정답 확인·필터 개수 자체 점검. 실행: npm run test
import assert from 'node:assert/strict';
import { diff, findMiss, norm, blankOf, exKind } from '../screens/Exercise';
import { countFeed, tabOf, TABS } from './feed';
import { GRAD_AT, streakInfo, wrongNote } from './srs';
import { dayKey } from './text';
import { DAY } from '../constants';
import { CARDS } from '../data';
import type { AppState, SavedItem } from '../types';

// norm: 대소문자·문장부호·공백 무시, 띄어 쓰지 않는 언어는 공백도 무시
assert.equal(norm("  I'm Running   LATE! ", 'en'), 'im running late');
assert.equal(norm('こんにちは、 世界。', 'ja'), 'こんにちは世界');

// diff: 몇 글자 다른지와 내가 쓴 글자 중 틀린 자리
assert.deepEqual(diff('runing', 'running').n, 1);
assert.equal(diff('running', 'running').n, 0);
assert.deepEqual([...diff('rxnning', 'running').bad], [1]);
assert.equal(diff('', 'abc').n, 3);

// findMiss: 정답 앞부분을 쓰는 중이면 지적하지 않아요
const en = CARDS.find((c) => c.id === 'en1')!;
const ans = en.key.map((i) => en.words[i]).join(' ');
assert.equal(findMiss('runn', ans, 'en', 'ko'), null);
assert.equal(findMiss('', ans, 'en', 'ko'), null);
// 다른 카드에 나오는 표현을 쓰면 그 뜻을 알려줘요
const other = CARDS.find((c) => c.lang === 'en' && c.id !== 'en1' && c.key.length)!;
const otherExpr = other.key.map((i) => other.words[i]).join(' ').replace(/[.,!?]+$/, '');
const miss = findMiss(otherExpr, ans, 'en', 'ko');
assert.ok(miss && miss.mean, `다른 표현 '${otherExpr}'의 뜻을 찾아야 해요`);

// 빈칸·연습 종류
const item = (kind: 'w' | 's', step: number, wi = -1) => ({ kind, step, wi, card: en }) as unknown as SavedItem;
assert.deepEqual(blankOf(item('w', 0, 2)), [2]);
assert.deepEqual(blankOf(item('s', 0)), en.key);
assert.equal(exKind(item('s', 4)), 'dictation');
assert.equal(exKind(item('s', 1)), 'type');

// 필터 개수: 전체 = 상황 탭별 합, 이미 아는 문장은 빠져요
const s = { learn: ['en'], custom: [], known: [], level: '전체' } as unknown as AppState;
const all = countFeed(s, '전체', []);
assert.equal(all, CARDS.filter((c) => c.lang === 'en').length);
assert.equal(TABS.reduce((n, t) => n + countFeed(s, '전체', [], t), 0), all);
assert.equal(countFeed({ ...s, known: ['en1'] } as AppState, '전체', []), all - 1);
assert.ok(TABS.includes(tabOf(en)));
const lv = ['초급', '중급', '고급'].reduce((n, l) => n + countFeed(s, l, []), 0);
assert.equal(lv, all, '난이도별 합도 전체와 같아야 해요');

// 오답 노트: 약점은 GRAD_AT번 연속 맞혀야 졸업, 틀리면 처음부터
const w = { ...item('s', 0), lapses: 2 } as SavedItem;
assert.deepEqual(wrongNote(w, 'good'), { lapses: 2, okRun: 1, grad: false });
assert.deepEqual(wrongNote({ ...w, okRun: GRAD_AT - 1 }, 'good'), { lapses: 0, okRun: 0, grad: true });
assert.deepEqual(wrongNote({ ...w, okRun: 2 }, 'again'), { lapses: 3, okRun: 0, grad: false });
assert.equal(wrongNote({ ...w, lapses: 1 }, 'good').lapses, 0);

// 쉬는 날 지키기: 한 주 한 번 하루 빈 날을 메우고, 이틀 연속 빈 날은 끊겨요
const wed = new Date(2026, 10, 18, 12).getTime(); // 수요일
const lg = (offs: number[]) => Object.fromEntries(offs.map((o) => [dayKey(wed - o * DAY), { n: 1, ok: 1 }]));
assert.equal(streakInfo(lg([0, 1, 2]), wed).n, 3);
const f = streakInfo(lg([0, 2, 3]), wed); // 화요일만 빠짐
assert.equal(f.n, 3); assert.equal(f.frozen.length, 1); assert.equal(f.left, 0);
assert.equal(streakInfo(lg([0, 3, 4]), wed).n, 1); // 이틀 빠지면 끊김
const sun = new Date(2026, 10, 22, 12).getTime(); // 같은 주 토·목이 빠지면 한 번만 메워요
assert.equal(streakInfo(Object.fromEntries([0, 2, 4, 5].map((o) => [dayKey(sun - o * DAY), { n: 1, ok: 1 }])), sun).n, 2);
assert.equal(streakInfo(lg([1, 2]), wed).left, 1);

console.log('ok answer/filter');
