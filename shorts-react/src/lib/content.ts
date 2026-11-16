// 문장·영상·이야기 내용. 앱에 묶인 것을 기본으로 쓰고, 서버의 content.json이 더 새것이면 받아 두었다가
// 다음에 앱을 열 때부터 써요. 그래서 앱을 업데이트하지 않아도 문장을 늘릴 수 있어요.
import cards from '../data/cards.json';
import gloss from '../data/gloss.json';
import stories from '../data/stories.json';
import videos from '../data/videos.json';

/** 내용(content.json)과 음성 파일을 받는 주소. 앱스토어 앱에서는 VITE_CONTENT_BASE로 서버 주소를 넣어요. */
export const CONTENT_BASE: string = import.meta.env.VITE_CONTENT_BASE || import.meta.env.BASE_URL;

type Content = { v: number; cards: unknown; gloss: unknown; stories: unknown; videos: unknown };
const KEY = 'content-cache';
const bundled: Content = { v: __CONTENT_V__, cards, gloss, stories, videos };

function load(): Content {
  try {
    const c = JSON.parse(localStorage.getItem(KEY) || 'null') as Content | null;
    if (c && c.v > bundled.v) return c;
  } catch { /* 저장소를 못 쓰면 앱에 묶인 내용으로 */ }
  return bundled;
}

export const CONTENT = load();

fetch(`${CONTENT_BASE}content.json`, { cache: 'no-cache' })
  .then((r) => (r.ok ? r.json() : null))
  .then((c: Content | null) => {
    if (c && typeof c.v === 'number' && c.v > CONTENT.v) localStorage.setItem(KEY, JSON.stringify(c));
  })
  .catch(() => { /* 인터넷이 없으면 지금 내용 그대로 */ });
