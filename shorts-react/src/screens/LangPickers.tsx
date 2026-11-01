import { LANGS } from '../data';
import { Chip } from '../components/Button';
import { useStore } from '../store';
import { useUi } from '../ui';

/** 내 언어 · 배우는 언어 고르기 (온보딩, 설정 > 언어 둘 다 쓴다) */
export function LangPickers({ onboarding, part }: { onboarding?: boolean; part?: 'native' | 'learn' }) {
  const { state, set } = useStore();
  const { toast } = useUi();

  const setNative = (code: string) => set((s) => {
    let learn = s.learn.filter((c) => c !== code);
    if (!learn.length && !onboarding) learn = [code === 'en' ? 'ja' : 'en'];
    return { native: code, learn };
  });
  const toggleLearn = (code: string) => {
    if (state.learn.includes(code)) {
      if (state.learn.length === 1 && !onboarding) { toast('배우는 언어를 하나 이상 골라 주세요'); return; }
      set({ learn: state.learn.filter((c) => c !== code) });
    } else set({ learn: [...state.learn, code] });
  };

  return (
    <div className="lang-pickers">
      {part !== 'learn' && <>
        <h3 className="sec">내 언어 (해석으로 보여줄 언어)</h3>
        <div className="grid">
          {LANGS.map((l) => <Chip key={l.code} on={l.code === state.native} onClick={() => setNative(l.code)}>{l.name}<small>{l.ko}</small></Chip>)}
        </div>
      </>}
      {part !== 'native' && <>
        <h3 className="sec">배우는 언어 (여러 개 선택)</h3>
        <div className="grid">
          {LANGS.filter((l) => l.code !== state.native).map((l) => (
            <Chip key={l.code} on={state.learn.includes(l.code)} onClick={() => toggleLearn(l.code)}>{l.name}<small>{l.ko}</small></Chip>
          ))}
        </div>
      </>}
    </div>
  );
}
