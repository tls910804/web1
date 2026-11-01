export interface Lang { code: string; name: string; ko: string; voice: string }

export interface Card {
  id: string;
  lang: string;
  cat: string;
  words: string[];
  key: number[];
  expr: string;
  tr: Record<string, string>;
  mean: Record<string, string>;
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
  | 'splash' | 'onboarding' | 'feed' | 'saved' | 'stats' | 'settings'
  | 'sub' | 'review' | 'review-done' | 'add' | 'streak';

export type SubName = 'langs' | 'learn' | 'review-mode' | 'notify' | 'display' | 'data' | 'account';

export type Rate = 'again' | 'hard' | 'good' | 'easy';

export interface ReviewSession { ids: string[]; i: number; shown: boolean; known: string[]; again: string[] }

export interface DialogAction { label: string; kind?: 'dark' | 'light' | 'danger'; fn?: () => void }
