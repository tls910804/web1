import { useState } from 'react';
import { Button } from '../components/Button';
import { CARDS } from '../data';
import { WordChips } from '../components/WordChips';
import { lang, trOf } from '../lib/text';
import { useStore } from '../store';
import { useUi } from '../ui';
import { LangPickers } from './LangPickers';

/** 첫 실행: 내 언어 → 배울 언어(+미리보기) → 곧바로 첫 카드 */
export function Onboarding() {
  const { state, set } = useStore();
  const { go, setIndex } = useUi();
  const [step, setStep] = useState<1 | 2>(1);
  const n = state.learn.length;
  const sample = CARDS.find((c) => c.lang === state.learn[0]);

  return (
    <section className="screen">
      <div className="page" style={{ paddingBottom: 150 }}>
        <div className="steps" aria-label={`${step} / 2 단계`}><i className="on" /><i className={step === 2 ? 'on' : ''} /></div>
        {step === 1 ? (
          <>
            <h2 className="title">어떤 언어로 설명해 드릴까요?</h2>
            <p className="desc">문장의 뜻을 이 언어로 보여 드려요.</p>
            <LangPickers part="native" onboarding />
          </>
        ) : (
          <>
            <h2 className="title">어떤 언어를 배울까요?</h2>
            <p className="desc">고른 언어의 문장이 섞여서 나와요. 여러 개 골라도 돼요.</p>
            <LangPickers part="learn" onboarding />
            {sample && (
              <div className="preview" key={sample.id}>
                <span className="pill">{lang(sample.lang).name} 미리보기</span>
                <WordChips card={sample} small />
                <p className="tr">{trOf(sample.tr, state.native)}</p>
              </div>
            )}
          </>
        )}
      </div>
      <div className="bottom" style={{ textAlign: 'center' }}>
        {step === 1 ? (
          <Button onClick={() => setStep(2)}>다음</Button>
        ) : (
          <>
            <Button disabled={!n} onClick={() => { set({ onboarded: true }); setIndex(0); go('feed'); }}>
              {n ? `시작하기 · ${n}개 언어` : '배울 언어를 골라 주세요'}
            </Button>
            <Button kind="link" onClick={() => setStep(1)}>이전</Button>
          </>
        )}
      </div>
    </section>
  );
}
