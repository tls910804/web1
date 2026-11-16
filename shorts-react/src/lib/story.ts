import type { Card } from '../types';

/** 이야기: 문장 3~5개로 된 짧은 대화. 각 줄은 보통 문장 카드와 같아서 저장·복습이 그대로 된다 */
export interface Story { id: string; lang: string; level: string; cat: string; tab?: string; title: Record<string, string>; cards: Card[] }

export type Line = { t: string; ko?: string; en?: string; m?: Record<string, string> };
export type RawStory = Omit<Story, 'cards'> & { lines: Line[] };

/** "Sorry I'm [running late]." → 단어 조각들 + 빈칸 위치. 띄어 쓰지 않는 언어는 '|'로 조각을 나눈다 */
export function lineToCard(s: Omit<Story, 'cards'>, l: Line, i: number): Card {
  const parts = l.t.includes('|') ? l.t.split('|') : l.t.match(/[^\s[]*\[[^\]]+\][^\s]*|[^\s]+/g) ?? [];
  const words: string[] = [];
  const key: number[] = [];
  let expr = '';
  for (const p of parts) {
    const m = p.match(/^(.*)\[([^\]]+)\](.*)$/);
    if (!m) { words.push(p); continue; }
    key.push(words.length);
    expr = m[2];
    words.push(m[1] + m[2] + m[3]); // 앞뒤 문장부호(¿, 쉼표)는 빈칸 단어에 붙여 둔다
  }
  const tr: Record<string, string> = {};
  if (l.ko) tr.ko = l.ko;
  if (l.en) tr.en = l.en;
  return { id: `${s.id}-${i}`, lang: s.lang, cat: s.cat, tab: s.tab, words, key, expr, tr, mean: l.m ?? {}, level: s.level };
}

export const buildStories = (raw: RawStory[]): Story[] => raw.map(({ lines, ...s }) => ({ ...s, cards: lines.map((l, i) => lineToCard(s, l, i)) }));
