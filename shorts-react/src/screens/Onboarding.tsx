import { Button } from '../components/Button';
import { useStore } from '../store';
import { useUi } from '../ui';
import { LangPickers } from './LangPickers';

export function Onboarding() {
  const { state, set } = useStore();
  const { go, setIndex } = useUi();
  const n = state.learn.length;
  return (
    <section className="screen">
      <div className="page" style={{ paddingBottom: 150 }}>
        <h2 className="title" style={{ marginTop: 24 }}>어떤 언어를 배울까요?</h2>
        <p className="desc">고른 언어의 문장이 섞여서 나와요. 나중에 언제든 바꿀 수 있어요.</p>
        <LangPickers onboarding />
      </div>
      <div className="bottom" style={{ textAlign: 'center' }}>
        <Button disabled={!n} onClick={() => { set({ onboarded: true }); setIndex(0); go('feed'); }}>
          {n ? `시작하기 · ${n}개 언어` : '배울 언어를 골라 주세요'}
        </Button>
        <div style={{ marginTop: 10, fontSize: 12, color: 'var(--muted)' }}>언어는 '설정' 탭에서 나중에 바꿀 수 있어요</div>
      </div>
    </section>
  );
}
