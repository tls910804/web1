import { useEffect, useRef, useState } from 'react';
import { DAY, FONT_SIZES } from './constants';
import { Icon } from './components/Icon';
import { Layer } from './components/Layer';
import { TAB_SCREENS, TabBar } from './components/TabBar';
import { Toast } from './components/Toast';
import { dueNotifications } from './lib/notify';
import { exportBackup } from './lib/backup';
import { speechOk } from './lib/speech';
import { dayKey, todayKey } from './lib/text';
import { useStore } from './store';
import { useUi } from './ui';
import { Add } from './screens/Add';
import { Feed } from './screens/Feed';
import { Onboarding } from './screens/Onboarding';
import { Review, ReviewDone } from './screens/Review';
import { Saved } from './screens/Saved';
import { Settings } from './screens/Settings';
import { Splash } from './screens/Splash';
import { Stats } from './screens/Stats';
import { StreakBroken } from './screens/Streak';
import { Sub } from './screens/Sub';

export function App() {
  const { state, set, saveFailed, retrySave } = useStore();
  const { screen, go, toast, openDialog, setStreakWas } = useUi();
  const [online, setOnline] = useState(navigator.onLine !== false);
  const stateRef = useRef(state);
  stateRef.current = state;

  // 화면 테마 · 글자 크기
  useEffect(() => {
    const mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
    const apply = () => {
      const t = state.theme === 'system' ? (mq?.matches ? 'dark' : 'light') : state.theme;
      document.documentElement.dataset.theme = t;
      document.documentElement.style.setProperty('--fs', String(FONT_SIZES[state.fontSize].v));
    };
    apply();
    mq?.addEventListener?.('change', apply);
    return () => mq?.removeEventListener?.('change', apply);
  }, [state.theme, state.fontSize]);

  // 모바일 브라우저는 하단 도구 모음이 접히고 펴지면서 화면 크기가 바뀌므로, 실제로 보이는 영역에 맞춘다.
  useEffect(() => {
    const fit = () => {
      const v = window.visualViewport;
      const root = document.documentElement.style;
      root.setProperty('--vh', `${v ? v.height : window.innerHeight}px`);
      root.setProperty('--vt', `${v ? v.offsetTop : 0}px`);
    };
    fit();
    window.addEventListener('resize', fit);
    window.addEventListener('orientationchange', fit);
    window.visualViewport?.addEventListener('resize', fit);
    window.visualViewport?.addEventListener('scroll', fit);
    if (speechOk() && speechSynthesis.getVoices) speechSynthesis.getVoices();
    return () => {
      window.removeEventListener('resize', fit);
      window.removeEventListener('orientationchange', fit);
      window.visualViewport?.removeEventListener('resize', fit);
      window.visualViewport?.removeEventListener('scroll', fit);
    };
  }, []);

  // 오프라인 안내
  useEffect(() => {
    const on = () => { setOnline(true); toast('다시 연결됐어요'); };
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, [toast]);

  // 알림: 앱을 다시 열었을 때 시각이 지났으면 한 번만 띄운다
  useEffect(() => {
    const check = () => {
      const notified = dueNotifications(stateRef.current);
      if (notified) set({ notified });
    };
    const onVis = () => { if (!document.hidden) check(); };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [set]);

  // 저장 공간이 꽉 차면 알려 준다
  useEffect(() => {
    if (!saveFailed) return;
    openDialog('저장하지 못했어요', '브라우저 저장 공간이 꽉 찼거나 비공개 모드일 수 있어요. 이 화면을 닫으면 방금 바꾼 내용이 사라질 수 있으니 파일로 내보내 두세요.', [
      { label: '다시 시도', kind: 'light', fn: () => { if (retrySave()) toast('저장했어요'); } },
      { label: '파일로 내보내기', kind: 'dark', fn: () => exportBackup(stateRef.current) },
    ]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saveFailed]);

  // 시작: 스플래시 뒤에 온보딩 또는 둘러보기. 연속 기록이 끊겼으면 안내 화면을 먼저 보여 준다.
  useEffect(() => {
    const t = setTimeout(() => {
      const s = stateRef.current;
      if (!s.onboarded) { go('onboarding'); return; }
      if (s.streak > 0 && s.lastReview && s.lastReview !== todayKey() && s.lastReview !== dayKey(Date.now() - DAY)) {
        setStreakWas(s.streak);
        set({ best: Math.max(s.best || 0, s.streak), streak: 0 });
        go('streak');
      } else go('feed');
      const notified = dueNotifications(stateRef.current);
      if (notified) set({ notified });
    }, 1100);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="app" id="app">
      {screen === 'splash' && <Splash />}
      {screen === 'onboarding' && <Onboarding />}
      {screen === 'feed' && <Feed />}
      {screen === 'saved' && <Saved />}
      {screen === 'stats' && <Stats />}
      {screen === 'settings' && <Settings />}
      {screen === 'sub' && <Sub />}
      {screen === 'review' && <Review />}
      {screen === 'review-done' && <ReviewDone />}
      {screen === 'add' && <Add />}
      {screen === 'streak' && <StreakBroken />}

      {!online && (
        <div className="net"><Icon name="offline" /><span><b>오프라인이에요</b>저장한 문장과 복습은 그대로 쓸 수 있어요</span></div>
      )}
      {TAB_SCREENS.includes(screen) && <TabBar />}
      <Toast />
      <Layer />
    </div>
  );
}
