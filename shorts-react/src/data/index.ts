import type { Card, Lang } from '../types';
import langs from './langs.json';
import cards from './cards.json';
import gloss from './gloss.json';

export const LANGS = langs as Lang[];
export const CARDS = cards as Card[];
// 단어별 뜻: 카드 id → 단어 조각 순서대로 "한국어|English"
export const GLOSS = gloss as Record<string, string[]>;
