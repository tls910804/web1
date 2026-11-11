export interface Lang { code: string; name: string; ko: string; voice: string }

export interface Card {
  id: string;
  lang: string;
  cat: string;
  /** 둘러보기 상단 탭. 없으면 회사는 '일·업무', 나머지는 '일상' */
  tab?: string;
  words: string[];
  key: number[];
  expr: string;
  tr: Record<string, string>;
  mean: Record<string, string>;
  /** 유튜브 영상 카드: 이 구간(초)을 카드 위에서 재생한다 */
  /** full: 카드 전체를 영상으로 채우고 자막을 위에 겹친다, ratio: 영상 가로/세로 비율 */
  video?: { id: string; start: number; end: number; times?: number[]; full?: boolean; ratio?: number };
}

export interface SavedItem {
  id: string;
  kind: 's' | 'w';
  card: Card;
  wi: number;
  learned: boolean;
  due: number;
  at: number;
  step: number;
  /** '다시'를 받은 횟수 (약점 판단) */
  lapses?: number;
  note?: string;
}

export type ThemeKey = 'light' | 'dark' | 'system';
export type FontKey = 'sm' | 'md' | 'lg';
export type ModeKey = 'std' | 'slow' | 'dense';

export interface AppState {
  onboarded: boolean;
  native: string;
  learn: string[];
  saved: SavedItem[];
  custom: Card[];
  known: string[];
  hideTr: boolean;
  tapped: boolean;
  account: string | null;
  loginAsked: boolean;
  streak: number;
  best: number;
  lastReview: string | null;
  log: Record<string, { n: number; ok: number }>;
  level: string;
  auto: boolean;
  autoRepeat: number;
  slow: boolean;
  mode: ModeKey;
  daily: number;
  fontSize: FontKey;
  theme: ThemeKey;
  notify: { morning: boolean; evening: boolean };
  notified: { m?: string; e?: string };
  notifyAsked: boolean;
  lastBackup: number | null;
}

export type Screen =
  | 'splash' | 'onboarding' | 'feed' | 'shorts' | 'saved' | 'stats' | 'settings'
  | 'sub' | 'review' | 'review-done' | 'add' | 'streak';

export type SubName = 'langs' | 'learn' | 'review-mode' | 'notify' | 'display' | 'data' | 'account';

export type Rate = 'again' | 'hard' | 'good' | 'easy';

export interface ReviewSession { ids: string[]; i: number; shown: boolean; known: string[]; again: string[] }

export interface DialogAction { label: string; kind?: 'dark' | 'light' | 'danger'; fn?: () => void }
