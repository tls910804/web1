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
  /** 초급(A1~A2 흔한 말) · 중급(B1~B2 관용 표현) · 고급(C1 긴 문장·뉘앙스). 없으면 길이로 추정 */
  level?: string;
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
  /** 오답 노트(약점)에 들어온 뒤 연속으로 맞힌 횟수. GRAD_AT번이면 졸업 */
  okRun?: number;
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
  /** 듣기 속도: 1 보통 · 0.8 조금 느리게 · 0.6 느리게 */
  speed: number;
  mode: ModeKey;
  daily: number;
  fontSize: FontKey;
  theme: ThemeKey;
  notify: { morning: boolean; evening: boolean };
  notified: { m?: string; e?: string };
  notifyAsked: boolean;
  lastBackup: number | null;
  /** 단어장 기록: '언어:단어' → [칸, 다음에 볼 시각] */
  vocab: Record<string, [number, number]>;
  /** 단어장에서 고른 주제. ''은 전체 */
  vocabTopic: string;
  /** 하다 만 단어장 한 판 (이어서 하기). code가 ''이면 없음 */
  /** 하루 목표 단어 수 (10·20·30) */
  vocabGoal: number;
  /** 단어장 공부한 날 (dayKey) */
  vocabDays: string[];
  /** 어려운 단어 (틀리면 저절로, 직접 별표도) */
  vocabStar: string[];
  /** 소리 없이: 저절로 읽어 주지 않아요 */
  vocabMute: boolean;
  /** 무료 새 단어 사용량 (lib/vocab.ts freeLeft) */
  vocabFree: { n: number; day: string; today: number; done: string };
  vocabRun: { code: string; ids: number[]; done: number[]; miss: number[]; knew: number[] };
}

export type Screen =
  | 'splash' | 'onboarding' | 'feed' | 'shorts' | 'saved' | 'stats' | 'settings'
  | 'sub' | 'review' | 'review-done' | 'add' | 'streak' | 'study' | 'call' | 'rest' | 'shorts2' | 'story' | 'vocab';

export type SubName = 'langs' | 'learn' | 'review-mode' | 'notify' | 'display' | 'data' | 'account';

export type Rate = 'again' | 'hard' | 'good' | 'easy';

/** 자동 공부: 둘러보기에서 이어지는 문장들(영상 제외)과, 끝나고 돌아갈 둘러보기 순서 */
export interface StudySession { queue: Card[]; feedIds: string[]; /** 끝나면 돌아갈 화면 (기본 둘러보기) */ back?: Screen }

export interface ReviewSession { ids: string[]; i: number; shown: boolean; known: string[]; again: string[] }

export interface DialogAction { label: string; kind?: 'dark' | 'light' | 'danger'; fn?: () => void }
