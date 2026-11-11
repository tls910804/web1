import { CARDS } from '../data';
import VIDEOS from '../data/videos.json';
import type { AppState, Card } from '../types';
import { levelOf } from './text';

export const allCards = (s: AppState): Card[] => CARDS.concat(s.custom).filter((c) => s.learn.includes(c.lang));

export function allCats(s: AppState) {
  const cats: string[] = [];
  allCards(s).forEach((c) => { if (!TABS.includes(c.cat) && !cats.includes(c.cat)) cats.push(c.cat); });
  return cats;
}

export const TABS = ['일상', '슬랭', '일·업무', '여행', '연애', '드라마·영화'];
export const tabOf = (c: Card) => c.tab ?? (c.cat === '회사' ? '일·업무' : c.cat === '여행' ? '여행' : '일상');
/** 학습 중인 언어에 카드가 있는 탭만 보여준다 */
export const tabList = (s: AppState) => TABS.filter((t) => allCards(s).some((c) => tabOf(c) === t));

function matches(s: AppState, c: Card, level: string, cats: string[], tab: string) {
  if (s.known.includes(c.id)) return false;
  if (tab && tabOf(c) !== tab) return false;
  if (level !== '전체' && levelOf(c) !== level && c.cat !== '내 문장') return false;
  return !cats.length || cats.includes(c.cat);
}

// 유튜브 정책에 맞춘 영상 카드: 영상은 자르거나 덮지 않고, 자막은 플레이어 아래에 둔다
const VIDEO_CARD: Card = {
  id: 'yt-friends-on-a-break', lang: 'en', cat: '감정', tab: '드라마·영화',
  words: ['Oh,', 'I', 'am', 'so', 'mad,', 'Ross.', 'I', "don't", 'think', "I've", 'ever', 'been', 'this', 'angry.', 'But', 'about', 'the', 'time', 'I', 'said', 'we', 'were', 'on a break.'],
  key: [22], expr: 'on a break',
  tr: { ko: '아, 나 정말 화났어, 로스. 이렇게 화난 적은 없는 것 같아. 그런데 내가 우리 잠깐 헤어진 거라고 했던 그때 말이야.', en: "Oh, I am so mad, Ross. I don't think I've ever been this angry. But about the time I said we were on a break." },
  mean: { ko: '(연인이) 잠시 헤어진 상태인', en: 'taking time apart in a relationship' },
  // 단어 시간은 이 쇼츠(Sitcom Dose)의 유튜브 자동 자막에서 읽은 값
  video: { id: 'Gf-7s8F85Vg', start: 0, end: 11, ratio: 9 / 16, times: [0.44, 0.69, 0.82, 1.19, 1.81, 2.19, 2.6, 2.69, 2.81, 3.06, 3.31, 3.44, 3.69, 3.94, 6.19, 6.31, 6.56, 6.69, 6.94, 7.06, 7.32, 7.44, 8.44] },
};

const VIDEO_CARDS: Card[] = [VIDEO_CARD, ...(VIDEOS as Card[])];

export const feedCards = (s: AppState, cats: string[], tab = '') => allCards(s).filter((c) => matches(s, c, s.level, cats, tab));
/** 쇼츠 탭: 영상 카드만. 둘러보기에는 섞지 않는다 */
export const videoCards = (s: AppState) => VIDEO_CARDS.filter((v) => s.learn.includes(v.lang) && !s.known.includes(v.id));
export const countFeed = (s: AppState, level: string, cats: string[], tab = '') => allCards(s).filter((c) => matches(s, c, level, cats, tab)).length;
