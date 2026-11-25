// 문장·영상·이야기·AI 통화 대본 내용. 앱에 묶인 것을 기본으로 쓰고, 서버의 content.json이 더 새것이면 받아 두었다가
// 다음에 앱을 열 때부터 써요. 그래서 앱을 업데이트하지 않아도 문장을 늘릴 수 있어요.
import calls from '../data/calls.json';
import cards from '../data/cards.json';
import gloss from '../data/gloss.json';
import stories from '../data/stories.json';
import videos from '../data/videos.json';

/** 내용(content.json)과 음성 파일을 받는 주소. 앱스토어 앱에서는 VITE_CONTENT_BASE로 서버 주소를 넣어요. */
export const CONTENT_BASE: string = import.meta.env.VITE_CONTENT_BASE || import.meta.env.BASE_URL;

type Content = { v: number; cards: unknown; gloss: unknown; stories: unknown; videos: unknown; calls?: unknown };
const KEY = 'content-cache';
const bundled: Content = { v: __CONTENT_V__, cards, gloss, stories, videos, calls };

// 저장 공간(약 500만 글자)은 학습 기록과 같이 써요. 큰 내용을 담으면 기록 저장이 실패할 수 있어서 받아 두지 않아요
// shortcut: 지금 내용은 이보다 커서 서버 갱신분은 담기지 않음. 앱스토어 앱에서 필요해지면 Cache API로 옮기기
export const keepable = (raw: string) => raw.length <= 2_000_000;

function load(): Content {
  try {
    const raw = localStorage.getItem(KEY);
    const c = raw && keepable(raw) ? (JSON.parse(raw) as Content) : null;
    if (c && c.v > bundled.v) return c;
    if (raw) localStorage.removeItem(KEY); // 크거나 낡은 것은 지워서 자리를 비워요
  } catch { /* 저장소를 못 쓰면 앱에 묶인 내용으로 */ }
  return bundled;
}

export const CONTENT = load();

fetch(`${CONTENT_BASE}content.json`, { cache: 'no-cache' })
  .then((r) => (r.ok ? r.text() : ''))
  .then((raw) => {
    if (!raw || !keepable(raw)) return;
    const c = JSON.parse(raw) as Content;
    if (typeof c.v === 'number' && c.v > CONTENT.v) localStorage.setItem(KEY, raw);
  })
  .catch(() => { /* 인터넷이 없으면 지금 내용 그대로 */ });
