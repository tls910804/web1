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
  /** 뜻(tr) 안에서 빈칸(key)에 해당하는 부분. 자동 공부에서 색으로 표시 */
  trKey?: Record<string, string>;
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
  /** 날짜별 기록: n 복습 수 · ok 맞춘 수 · s 자동 공부 문장 · c AI 전화 */
  log: Record<string, { n: number; ok: number; s?: number; c?: number }>;
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
  | 'sub' | 'review' | 'review-done' | 'add' | 'streak' | 'study' | 'call' | 'rest' | 'shorts2';

export type SubName = 'langs' | 'learn' | 'review-mode' | 'notify' | 'display' | 'data' | 'account';

export type Rate = 'again' | 'hard' | 'good' | 'easy';

/** 자동 공부: 둘러보기에서 이어지는 문장들(영상 제외)과, 끝나고 돌아갈 둘러보기 순서 */
export interface StudySession { queue: Card[]; feedIds: string[] }

export interface ReviewSession { ids: string[]; i: number; shown: boolean; known: string[]; again: string[] }

export interface DialogAction { label: string; kind?: 'dark' | 'light' | 'danger'; fn?: () => void }
