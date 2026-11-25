import type { Card, Lang } from '../types';
import langs from './langs.json';
import { CONTENT } from '../lib/content';
import { buildStories, type RawStory } from '../lib/story';

export const LANGS = langs as Lang[];
/** 배울 언어로 고를 수 있는 언어(내 언어는 11개 다). 나머지(fr·de·pt·ru·vi)는 콘텐츠가 모이면 여기에 다시 넣어요 */
export const ON_LANGS = ['en', 'ko', 'ja', 'zh', 'es', 'id'];
export const SHOWN_LANGS = LANGS.filter((l) => ON_LANGS.includes(l.code));
export const CARDS = CONTENT.cards as Card[];
// 단어별 뜻: 카드 id → 단어 조각 순서대로 "한국어|English"
export const GLOSS = CONTENT.gloss as Record<string, string[]>;
export const STORIES = buildStories(CONTENT.stories as RawStory[]);
