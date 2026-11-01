import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useStore } from './store';
import { playAudio, stopAudio } from './lib/audio';
import { hasVoice, say, speechOk } from './lib/speech';
import { lang } from './lib/text';
import type { DialogAction, ReviewSession, Screen, SubName } from './types';

type Layer =
  | { kind: 'sheet'; node: ReactNode }
  | { kind: 'dialog'; title: string; body: string; actions: DialogAction[] };

interface Toast { id: number; msg: string; label?: string; fn?: () => void }

export interface SpeakOpt { rate?: number; repeat?: number; quiet?: boolean }

interface Ui {
  screen: Screen;
  go: (s: Screen) => void;
  sub: SubName | null;
  openSub: (s: SubName) => void;
  goBack: () => void;

  layer: Layer | null;
  openSheet: (node: ReactNode) => void;
  openDialog: (title: string, body: string, actions: DialogAction[]) => void;
  closeLayer: () => void;
  /** 단어 시트가 열려 있을 때 카드에서 강조할 조각 */
  selection: { cardId: string; set: number[] } | null;
  setSelection: (v: { cardId: string; set: number[] } | null) => void;

  toast: (msg: string, label?: string, fn?: () => void) => void;
  toastNode: Toast | null;
  dismissToast: () => void;

  speak: (text: string, code: string, opt?: SpeakOpt) => void;

  // 화면을 떠났다 돌아와도 남아야 하는 상태
  cats: string[];
  setCats: (c: string[]) => void;
  index: number;
  setIndex: (i: number) => void;
  savedTab: 's' | 'w';
  setSavedTab: (t: 's' | 'w') => void;
  savedFilter: 'learning' | 'weak' | 'learned';
  setSavedFilter: (f: 'learning' | 'weak' | 'learned') => void;
  statsRange: 'week' | 'month';
  setStatsRange: (r: 'week' | 'month') => void;
  rv: ReviewSession | null;
  setRv: (r: ReviewSession | null) => void;
  streakWas: number;
  setStreakWas: (n: number) => void;
}

const Ctx = createContext<Ui | null>(null);

export function UiProvider({ children }: { children: ReactNode }) {
  const { state } = useStore();
  const [screen, setScreen] = useState<Screen>('splash');
  const [sub, setSub] = useState<SubName | null>(null);
  const [subStack, setSubStack] = useState<SubName[]>([]);
  const [layer, setLayer] = useState<Layer | null>(null);
  const [selection, setSelection] = useState<Ui['selection']>(null);
  const [toastNode, setToastNode] = useState<Toast | null>(null);
  const [cats, setCats] = useState<string[]>([]);
  const [index, setIndex] = useState(0);
  const [savedTab, setSavedTab] = useState<'s' | 'w'>('s');
  const [savedFilter, setSavedFilter] = useState<'learning' | 'weak' | 'learned'>('learning');
  const [statsRange, setStatsRange] = useState<'week' | 'month'>('week');
  const [rv, setRv] = useState<ReviewSession | null>(null);
  const [streakWas, setStreakWas] = useState(0);
  const voiceWarned = useRef<Record<string, boolean>>({});
  const toastId = useRef(0);

  const closeLayer = useCallback(() => { setLayer(null); setSelection(null); }, []);
  const openSheet = useCallback((node: ReactNode) => setLayer({ kind: 'sheet', node }), []);
  const openDialog = useCallback((title: string, body: string, actions: DialogAction[]) => setLayer({ kind: 'dialog', title, body, actions }), []);

  const go = useCallback((s: Screen) => {
    setScreen(s);
    closeLayer();
    if (s === 'settings') setSubStack([]);
    if (s !== 'feed') { stopAudio(); if (speechOk()) speechSynthesis.cancel(); }
  }, [closeLayer]);

  const openSub = useCallback((name: SubName) => {
    if (screen === 'sub' && sub) setSubStack((st) => [...st, sub]);
    else setSubStack([]);
    setSub(name);
    go('sub');
  }, [screen, sub, go]);

  const goBack = useCallback(() => {
    if (subStack.length) {
      setSub(subStack[subStack.length - 1]);
      setSubStack(subStack.slice(0, -1));
      go('sub');
    } else go('settings');
  }, [subStack, go]);

  const toast = useCallback((msg: string, label?: string, fn?: () => void) => {
    setToastNode({ id: ++toastId.current, msg, label, fn });
  }, []);
  const dismissToast = useCallback(() => setToastNode(null), []);
  useEffect(() => {
    if (!toastNode) return;
    const t = setTimeout(() => setToastNode((cur) => (cur && cur.id === toastNode.id ? null : cur)), toastNode.label ? 3500 : 1600);
    return () => clearTimeout(t);
  }, [toastNode]);

  const speak = useCallback((text: string, code: string, opt: SpeakOpt = {}) => {
    const rate = opt.rate || (state.slow ? 0.7 : 0.9);
    // 미리 만들어 둔 음성이 있으면 그걸 쓰고, 없을 때만 브라우저 기본 음성으로 읽는다
    if (playAudio(text, code, rate < 0.8, opt.repeat)) {
      if (speechOk()) speechSynthesis.cancel();
      return;
    }
    if (!speechOk()) {
      if (!opt.quiet) openDialog('음성을 들을 수 없어요', '이 브라우저는 발음 듣기를 지원하지 않아요. 크롬이나 사파리 최신 버전에서 열어 주세요.', [{ label: '확인', kind: 'dark' }]);
      return;
    }
    if (!hasVoice(code) && !voiceWarned.current[code]) {
      voiceWarned.current[code] = true;
      const l = lang(code);
      openDialog(`이 기기에 ${l.ko} 음성이 없어요`, `기기 설정의 '텍스트 음성 변환'에서 ${l.ko} 음성을 내려받으면 정확한 발음으로 들을 수 있어요. 지금은 기본 음성으로 읽어요.`, [{ label: '확인', kind: 'dark' }]);
    }
    say(text, code, rate, opt.repeat);
  }, [openDialog, state.slow]);

  const value = useMemo<Ui>(() => ({
    screen, go, sub, openSub, goBack, layer, openSheet, openDialog, closeLayer, selection, setSelection,
    toast, toastNode, dismissToast, speak,
    cats, setCats, index, setIndex, savedTab, setSavedTab, savedFilter, setSavedFilter,
    statsRange, setStatsRange, rv, setRv, streakWas, setStreakWas,
  }), [screen, go, sub, openSub, goBack, layer, openSheet, openDialog, closeLayer, selection, toast, toastNode, dismissToast, speak,
    cats, index, savedTab, savedFilter, statsRange, rv, streakWas]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useUi() {
  const v = useContext(Ctx);
  if (!v) throw new Error('UiProvider 안에서만 쓸 수 있어요');
  return v;
}
