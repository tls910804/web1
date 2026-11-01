import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { STORE_KEY } from './constants';
import type { AppState } from './types';

const defaults: AppState = {
  onboarded: false,
  native: 'ko',
  learn: ['en'],
  saved: [],
  custom: [],
  known: [],
  hideTr: false,
  tapped: false,
  account: null,
  loginAsked: false,
  streak: 0,
  best: 0,
  lastReview: null,
  log: {},
  level: '전체',
  auto: true,
  autoRepeat: 1,
  slow: false,
  mode: 'std',
  daily: 10,
  fontSize: 'md',
  theme: 'light',
  notify: { morning: false, evening: false },
  notified: {},
  notifyAsked: false,
  lastBackup: null,
};

// 이전 버전 데이터도 그대로 읽도록 기본값 위에 덮어쓴다 (저장 키는 기존 앱과 같다)
export function normalize(raw: Partial<AppState>): AppState {
  const s = { ...defaults, ...raw };
  s.saved = s.saved.map((x) => {
    const item = { ...x };
    if (item.wi === undefined) {
      item.wi = -1;
      if (item.kind === 'w' && item.id.split(':').length === 2) item.id += ':e';
    }
    if (item.step === undefined) item.step = 0;
    return item;
  });
  if (!s.best || s.best < s.streak) s.best = s.streak;
  return s;
}

function load(): AppState {
  try {
    return normalize(JSON.parse(localStorage.getItem(STORE_KEY) || '{}') || {});
  } catch {
    return normalize({});
  }
}

type Patch = Partial<AppState> | ((s: AppState) => Partial<AppState>);

interface Store {
  state: AppState;
  set: (patch: Patch) => void;
  replace: (s: AppState) => void;
  saveFailed: boolean;
  retrySave: () => boolean;
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(load);
  const [saveFailed, setSaveFailed] = useState(false);
  const stateRef = useRef(state);
  stateRef.current = state;

  const write = useCallback((s: AppState) => {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(s));
      setSaveFailed(false);
      return true;
    } catch {
      setSaveFailed(true);
      return false;
    }
  }, []);

  useEffect(() => { write(state); }, [state, write]);

  const set = useCallback((patch: Patch) => {
    setState((s) => ({ ...s, ...(typeof patch === 'function' ? patch(s) : patch) }));
  }, []);
  const replace = useCallback((s: AppState) => setState(normalize(s)), []);
  const retrySave = useCallback(() => write(stateRef.current), [write]);

  const value = useMemo(() => ({ state, set, replace, saveFailed, retrySave }), [state, set, replace, saveFailed, retrySave]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const v = useContext(Ctx);
  if (!v) throw new Error('StoreProvider 안에서만 쓸 수 있어요');
  return v;
}
