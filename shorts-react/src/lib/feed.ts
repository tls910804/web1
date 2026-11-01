import { CARDS } from '../data';
import type { AppState, Card } from '../types';
import { levelOf } from './text';

export const allCards = (s: AppState): Card[] => CARDS.concat(s.custom).filter((c) => s.learn.includes(c.lang));

export function allCats(s: AppState) {
  const cats: string[] = [];
  allCards(s).forEach((c) => { if (!cats.includes(c.cat)) cats.push(c.cat); });
  return cats;
}

function matches(s: AppState, c: Card, level: string, cats: string[]) {
  if (s.known.includes(c.id)) return false;
  if (level !== '전체' && levelOf(c) !== level && c.cat !== '내 문장') return false;
  return !cats.length || cats.includes(c.cat);
}

export const feedCards = (s: AppState, cats: string[]) => allCards(s).filter((c) => matches(s, c, s.level, cats));
export const countFeed = (s: AppState, level: string, cats: string[]) => allCards(s).filter((c) => matches(s, c, level, cats)).length;
