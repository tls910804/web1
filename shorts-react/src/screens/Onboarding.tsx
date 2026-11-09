import { useState } from 'react';
import { Button } from '../components/Button';
import { FaceButton } from '../components/FaceButton';
import { Icon } from '../components/Icon';
import { CARDS } from '../data';
import { WordChips } from '../components/WordChips';
import { lang, langTag, sentence, trOf } from '../lib/text';
import { useStore } from '../store';
import { useUi } from '../ui';
import { LangPickers } from './LangPickers';

const TIMELINE = [
  ['오늘', '문장을 저장해요', '배울래요 탭에 차곡차곡 쌓여요'],
  ['1일 뒤', '처음 복습해요', '기억나는지 가볍게 확인해요'],
  ['3일 뒤', '기억나면 간격이 늘어요', '헷갈리면 다시 짧아져요'],
  ['7일 뒤', '더 오래 기억해요', '점점 간격이 길어져요'],
];

const RECAP = [
  ['mark', '두 번 탭해서 저장', '마음에 드는 문장은 배울래요에 쌓여요'],
  ['repeat', '잊을 때쯤 복습', '배울래요 탭에서 복습을 시작해요'],
  ['chart', '기록으로 확인', '연속 일수와 진행률이 기록 탭에 쌓여요'],
] as const;

/** 첫 실행: 내 언어 → 배울 언어 → 저장 체험 → 복습 이해 → 복습 체험 → 준비 완료 (3~5단계는 건너뛸 수 있다) */
export function Onboarding() {
  const { state, set } = useStore();
  const { go, setIndex, speak } = useUi();
  const [step, setStep] = useState(1);
  const [tapped, setTapped] = useState(false);
  const [saved, setSaved] = useState(false);
  const n = state.learn.length;
  const sample = CARDS.find((c) => c.lang === state.learn[0]);
  const finish = () => { set({ onboarded: true }); setIndex(0); go('feed'); };
  const tr = sample ? trOf(sample.tr, state.native) : '';

  // 저장 체험 가이드: 1 단어 누르기 → 2 두 번 탭 → 3 완료
  const guide = !tapped ? 1 : !saved ? 2 : 3;
  const practiceCard = (back: boolean) => sample && (
    <div className={`rcard ob-practice${back ? ' back' : ` g${guide}`}`} onDoubleClick={() => !back && setSaved(true)}>
      {back ? (
        <span className="rc-chip">{sample.cat} · {lang(sample.lang).name}</span>
      ) : (
        <div className="ob-head"><span className="ob-tag">연습</span><span className="rc-chip">{lang(sample.lang).name}</span></div>
      )}
      <div className="rc-main">
        {back
          ? <p className="rc-s" lang={langTag(sample.lang)}>{sentence(sample)}</p>
          : <WordChips card={sample} onWord={() => setTapped(true)} />}
        {back && <div className="rc-line" />}
        <p className="rc-tr">{tr}</p>
        <div className="rc-expr"><b lang={langTag(sample.lang)}>{sample.expr}</b><span>{trOf(sample.mean, state.native)}</span></div>
      </div>
      <div className="rc-rail" onClick={(e) => e.stopPropagation()}>
        {!back && <button aria-label="저장" onClick={() => setSaved((v) => !v)}><Icon name="mark" style={saved ? { fill: 'currentColor' } : undefined} /></button>}
        <button aria-label="발음 듣기" onClick={() => speak(sentence(sample), sample.lang)}><Icon name="speak" /></button>
        <button aria-label="느리게 듣기" onClick={() => speak(sentence(sample), sample.lang, { rate: 0.7 })}><Icon name="clock" /></button>
        {!back && <><button aria-label="해석 가림"><Icon name="eye" /></button><button aria-label="복사"><Icon name="copy" /></button></>}
      </div>
      {!back && guide === 2 && <i className="ob-tap" aria-hidden />}
    </div>
  );

  return (
    <section className="screen">
      <div className="page" style={{ paddingTop: 16, paddingBottom: 190 }}>
        {step <= 5 && <div className="ob-n">{Math.min(step, 4)} / 4</div>}
        {step === 1 && (
          <>
            <h2 className="title">어떤 언어로 설명해 드릴까요?</h2>
            <p className="desc">문장의 뜻을 이 언어로 보여 드려요.</p>
            <LangPickers part="native" onboarding />
          </>
        )}
        {step === 2 && (
          <>
            <h2 className="title">어떤 언어를 배울까요?</h2>
            <p className="desc">고른 언어의 문장이 섞여서 나와요. 아래에서 어떤 모습인지 미리 볼 수 있어요.</p>
            <LangPickers part="learn" onboarding />
            {sample && (
              <div className="preview" key={sample.id}>
                <span className="pv-cap">미리보기 · {lang(sample.lang).name}</span>
                <WordChips card={sample} />
                <p className="tr">{tr}</p>
              </div>
            )}
          </>
        )}
        {step === 3 && (
          <>
            <h2 className="title">{['파란 단어를 눌러 보세요', '카드를 두 번 톡톡 눌러 저장해요', '잘했어요! 문장을 저장했어요'][guide - 1]}</h2>
            <p className="desc">{['모르는 단어는 눌러서 뜻을 바로 확인해요.', '마음에 드는 문장은 배울래요에 모아 두고 복습해요.', '저장한 문장은 배울래요 탭에서 다시 볼 수 있어요.'][guide - 1]}</p>
            <div className="ob-missions">
              <span className={tapped ? 'fin' : 'now'}><i>{tapped ? '✓' : 1}</i>단어 누르기</span>
              <span className={saved ? 'fin' : tapped ? 'now' : ''}><i>{saved ? '✓' : 2}</i>두 번 탭해서 저장</span>
            </div>
            {practiceCard(false)}
            {guide === 2 && <div className="ob-coach"><b>카드 아무 곳이나 톡톡 두 번</b><small>오른쪽 저장 아이콘을 눌러도 돼요</small></div>}
            {guide === 3 && <div className="ob-saved"><Icon name="check" />배울래요에 저장했어요</div>}
          </>
        )}
        {step === 4 && (
          <>
            <h2 className="title">잊을 때쯤 다시<br />보여 드려요</h2>
            <p className="desc">기억이 날수록 간격이 길어지고, 헷갈리면 다시 짧아져요.</p>
            <div className="ob-card ob-line">
              <p className="ob-cap">저장한 문장은 이렇게 돌아와요</p>
              {TIMELINE.map(([d, t, s]) => (
                <div key={d}><em>{d}</em><u /><span><b>{t}</b><small>{s}</small></span></div>
              ))}
            </div>
            <div className="ob-info"><Icon name="info" /><span><b>복습은 배울래요 탭에서 시작해요</b><small>하루 몇 문장만 가볍게 해도 충분해요</small></span></div>
          </>
        )}
        {step === 5 && <div className="rv-card" style={{ position: 'relative' }}>{practiceCard(true)}</div>}
        {step === 6 && (
          <div className="ob-done">
            <div className="ok"><Icon name="check" style={{ width: 44, height: 44, stroke: '#fff', strokeWidth: 2.5 }} /></div>
            <h2 className="title">준비 끝! 이제 시작해요</h2>
            <p className="desc">앞으로는 이렇게 쓰면 돼요.</p>
            {RECAP.map(([ic, t, s]) => (
              <div className="ob-row" key={t}><span><Icon name={ic} /></span><div><b>{t}</b><small>{s}</small></div></div>
            ))}
          </div>
        )}
      </div>
      <div className="bottom rv-card" style={{ textAlign: 'center' }}>
        {step === 1 && <Button onClick={() => setStep(2)}>다음</Button>}
        {step === 2 && (
          <>
            <Button disabled={!n} onClick={() => setStep(3)}>{n ? `시작하기 · ${n}개 언어` : '배울 언어를 골라 주세요'}</Button>
            <p className="ob-foot" style={{ marginTop: 10 }}>언어는 '설정' 탭에서 나중에 바꿀 수 있어요</p>
          </>
        )}
        {step === 3 && (
          <>
            <p className={`ob-foot${guide === 3 ? ' fin' : ''}`}>{['단어를 누르면 다음 미션이 열려요 · 0 / 2', '한 번만 더 하면 끝나요 · 1 / 2', '미션 완료 · 2 / 2'][guide - 1]}</p>
            <Button disabled={!(tapped && saved)} onClick={() => setStep(4)}>다음</Button>
          </>
        )}
        {step === 4 && <Button onClick={() => setStep(5)}>복습 해 보기</Button>}
        {step === 5 && (
          <>
            <span className="ob-bubble tip">하나를 골라 보세요</span>
            <div className="ans-row">
              <FaceButton kind="again" label="다시 볼래요" sub="내일" onClick={() => setStep(6)} />
              <FaceButton kind="good" label="기억나요" sub="3일 뒤" onClick={() => setStep(6)} />
            </div>
          </>
        )}
        {step === 6 && <Button onClick={finish}>첫 카드 보러 가기</Button>}
        {(step === 3 || step === 4 || step === 5) && <Button kind="link" style={{ marginTop: -4 }} onClick={finish}>건너뛰기</Button>}
      </div>
    </section>
  );
}
