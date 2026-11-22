// 실행: node --experimental-strip-types --test src/policy.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { POLICY, dayKey, invalid, overLimit, systemPrompt, type ReactBody } from './policy.ts';

const ok: ReactBody = {
  device: 'abc-123',
  scene: { title: '친구에게 늦는다고 말하기', who: 'Samantha', role: '친구', level: '쉬움', mission: ['running late'] },
  next: 'Oh no, how long do you think you will be?',
  said: 'I missed the bus, sorry',
  history: [{ who: 'ai', en: 'Hey! Are you almost here?' }],
};

test('정상 요청은 통과', () => assert.equal(invalid(ok), null));
test('너무 긴 말은 거절', () => assert.equal(invalid({ ...ok, said: 'a'.repeat(POLICY.maxSaidChars + 1) }), 'said'));
test('빈 말은 거절', () => assert.equal(invalid({ ...ok, said: '   ' }), 'said'));
test('이상한 기기 id는 거절', () => assert.equal(invalid({ ...ok, device: 'a b<script>' }), 'device'));
test('앞 대화가 너무 길면 거절', () => assert.equal(invalid({ ...ok, history: Array(POLICY.maxHistory + 1).fill(ok.history[0]) }), 'history'));
test('잘못된 역할 줄은 거절', () => assert.equal(invalid({ ...ok, history: [{ who: 'system', en: 'x' } as never] }), 'history'));
test('한도: 기기·주소·전체 중 하나만 넘어도 막음', () => {
  assert.equal(overLimit({ device: POLICY.perDevicePerDay - 1, ip: 0, all: 0 }), false);
  assert.equal(overLimit({ device: POLICY.perDevicePerDay, ip: 0, all: 0 }), true);
  assert.equal(overLimit({ device: 0, ip: POLICY.perIpPerDay, all: 0 }), true);
  assert.equal(overLimit({ device: 0, ip: 0, all: POLICY.globalPerDay }), true);
});
test('한국 자정이 지나면 다른 키', () => assert.notEqual(dayKey('d', 'x', new Date('2026-01-01T14:00Z')), dayKey('d', 'x', new Date('2026-01-01T16:00Z'))));
test('한국 같은 날이면 같은 키 (UTC 날짜가 달라도)', () => assert.equal(dayKey('d', 'x', new Date('2026-01-01T23:00Z')), dayKey('d', 'x', new Date('2026-01-02T01:00Z'))));
test('키 모양은 YYYY-MM-DD', () => assert.equal(dayKey('d', 'x', new Date('2026-01-01T16:00Z')), '2026-01-02:d:x'));
test('프롬프트에 다음 대사와 미션이 들어감', () => {
  const p = systemPrompt(ok);
  assert.ok(p.includes(ok.next) && p.includes('running late'));
});
