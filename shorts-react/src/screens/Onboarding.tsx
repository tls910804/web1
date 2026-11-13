import { useEffect, useState } from 'react';
import { tt } from '../i18n';
import { Button } from '../components/Button';
import { FaceButton } from '../components/FaceButton';
import { Icon } from '../components/Icon';
import { CARDS, LANGS } from '../data';
import { WordChips } from '../components/WordChips';
import { lang, langTag, sentence, trOf } from '../lib/text';
import { useStore } from '../store';
import { useUi } from '../ui';
import { useLangPick } from './LangPickers';
import { Code } from './Settings';
import { Flag } from '../components/Flag';
import { Exercise } from './Exercise';

const TIMELINE = [
  [tt('오늘'), tt('문장을 저장해요'), tt('배울래요 탭에 차곡차곡 쌓여요')],
  [tt('1일 뒤'), tt('처음 복습해요'), tt('기억나는지 가볍게 확인해요')],
  [tt('3일 뒤'), tt('기억나면 간격이 늘어요'), tt('헷갈리면 다시 짧아져요')],
  [tt('7일 뒤'), tt('더 오래 기억해요'), tt('점점 간격이 길어져요')],
];

// 맨 처음 화면은 누가 볼지 몰라서 고른 언어로 바로 보여 준다 (앱 번역 파일과 따로)
const ASK: Record<string, [string, string, string, string]> = {
  ko: ['어떤 언어를 쓰세요?', '문장의 뜻과 설명이 이 언어로 나와요.', '기기 언어', '한국어로 시작하기'],
  en: ['Which language do you speak?', 'Meanings and explanations will appear in this language.', 'Device', 'Continue in English'],
  ja: ['どの言語を使いますか？', '文の意味と説明がこの言語で表示されます。', '端末の言語', '日本語で始める'],
  zh: ['你使用哪种语言？', '句子的意思和说明将以这种语言显示。', '设备语言', '用中文开始'],
  es: ['¿Qué idioma hablas?', 'Los significados y explicaciones aparecerán en este idioma.', 'Del dispositivo', 'Continuar en español'],
  fr: ['Quelle langue parlez-vous ?', "Les sens et explications s'afficheront dans cette langue.", "De l'appareil", 'Continuer en français'],
  de: ['Welche Sprache sprichst du?', 'Bedeutungen und Erklärungen erscheinen in dieser Sprache.', 'Gerät', 'Weiter auf Deutsch'],
  pt: ['Qual idioma você fala?', 'Os significados e explicações aparecerão neste idioma.', 'Do aparelho', 'Continuar em português'],
  ru: ['На каком языке вы говорите?', 'Значения и пояснения будут на этом языке.', 'Язык устройства', 'Продолжить на русском'],
  vi: ['Bạn nói ngôn ngữ nào?', 'Nghĩa và giải thích sẽ hiển thị bằng ngôn ngữ này.', 'Thiết bị', 'Tiếp tục bằng tiếng Việt'],
  id: ['Bahasa apa yang kamu gunakan?', 'Arti dan penjelasan akan tampil dalam bahasa ini.', 'Perangkat', 'Lanjut dengan bahasa Indonesia'],
};
const HELLO = [['en', 'Hello'], ['ko', '안녕하세요'], ['ja', 'こんにちは'], ['es', '¡Hola!']];
const NAT_ORDER = ['ko', 'en', 'ja', 'zh', 'es', 'id', 'vi', 'fr', 'de', 'pt', 'ru'];
/** 진행 점: 내 언어 → 배울 언어 → 저장 체험 → 복습 */
const Dots = ({ at }: { at: number }) => <div className="ob-dots">{[0, 1, 2, 3].map((i) => <i key={i} className={i === at ? 'on' : ''} />)}</div>;

const RECAP = [
  ['mark', tt('두 번 탭해서 저장'), tt('마음에 드는 문장은 배울래요에 쌓여요')],
  ['repeat', tt('잊을 때쯤 복습'), tt('배울래요 탭에서 복습을 시작해요')],
  ['chart', tt('기록으로 확인'), tt('연속 일수와 진행률이 기록 탭에 쌓여요')],
] as const;

/** 첫 실행: 내 언어(기기 언어가 미리 골라짐) → 배울 언어 → 저장 체험 → 복습 이해 → 복습 체험 → 준비 완료 (3~5단계는 건너뛸 수 있다) */
export function Onboarding() {
  const { state, set } = useStore();
  const { go, setIndex, speak } = useUi();
  const [step, setStep] = useState(1);
  const { setNative, toggleLearn } = useLangPick(true);
  const dev = navigator.language.slice(0, 2);
  const ask = ASK[state.native] || ASK.en;
  // 설명 언어는 묻지 않고 기기 언어로 맞춘다 (지원하지 않는 언어면 기본값 유지)
  useEffect(() => {
    const code = navigator.language.slice(0, 2);
    if (code !== state.native && LANGS.some((l) => l.code === code)) set((s) => ({ native: code, learn: s.learn.filter((c) => c !== code) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
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
        <div className="ob-head"><span className="ob-tag">{tt('연습')}</span><span className="rc-chip">{lang(sample.lang).name}</span></div>
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
        {!back && <button aria-label={tt('저장')} onClick={() => setSaved((v) => !v)}><Icon name="mark" style={saved ? { fill: 'currentColor' } : undefined} /></button>}
        <button aria-label={tt('발음 듣기')} onClick={() => speak(sentence(sample), sample.lang)}><Icon name="speak" /></button>
        <button aria-label={tt('느리게 듣기')} onClick={() => speak(sentence(sample), sample.lang, { rate: 0.7 })}><Icon name="clock" /></button>
        {!back && <><button aria-label={tt('해석 가림')}><Icon name="eye" /></button><button aria-label={tt('복사')}><Icon name="copy" /></button></>}
      </div>
      {!back && guide === 2 && <i className="ob-tap" aria-hidden />}
    </div>
  );

  // 4/4 복습 체험: 3단계에서 저장한 표현을 실제 복습처럼 직접 써 본다
  if (step === 5 && sample?.key.length) {
    const item = { id: 'ob', kind: 's' as const, card: sample, wi: -1, learned: false, due: 0, at: 0, step: 0 };
    return (
      <section className="screen rv-card ob-rv">
        <div className="ob-rv-head">
          <Dots at={3} />
          <h2 className="title">{tt('저장한 표현, 기억나나요?')}</h2>
          <p className="desc">{tt('복습은 빈칸을 직접 써 보는 방식이에요.')}</p>
        </div>
        <Exercise kind="type" item={item} practice onDone={() => setStep(6)} onSkip={() => setStep(6)} />
      </section>
    );
  }

  return (
    <section className={`screen${step === 1 ? ' ob-s1' : ''}`}>
      <div className="page" style={{ paddingTop: 16, paddingBottom: step === 2 ? 300 : 190 }}>
        {step >= 3 && step <= 5 && <Dots at={Math.min(step - 1, 3)} />}
        {step === 1 && (
          <>
            <Dots at={0} />
            <div className="ob-hi">{HELLO.map(([c, h]) => <span key={h}><Flag code={c} size={18} />{h}</span>)}</div>
            <h2 className="title ob-q">{ask[0]}</h2>
            {state.native !== 'en' && <p className="ob-en">Which language do you speak?</p>}
            <div className="ob-nat">
              {[...LANGS].sort((a, b) => (a.code === dev ? -1 : b.code === dev ? 1 : NAT_ORDER.indexOf(a.code) - NAT_ORDER.indexOf(b.code))).map((l) => {
                const on = l.code === state.native;
                const sub = l.code === dev ? ask[2] : state.native === 'ko' && l.code !== 'ko' ? l.ko : '';
                return (
                  <button key={l.code} className={on ? 'on' : ''} onClick={() => setNative(l.code)}>
                    <Flag code={l.code} />
                    <span className="nm"><b>{l.name.replace('Bahasa ', '')}</b>{sub && <small className={l.code === dev ? 'dev' : ''}>{sub}</small>}</span>
                    {on && <span className="ck"><Icon name="check" /></span>}
                  </button>
                );
              })}
            </div>
          </>
        )}
        {step === 2 && (
          <>
            <div className="ob-top"><Dots at={1} /><button className="ob-natpill" onClick={() => setStep(1)}>{tt('뜻은')} <b>{lang(state.native).ko}</b><Icon name="chev" /></button></div>
            <h2 className="title ob-q">{tt('어떤 언어를')}<br />{tt('배울까요?')}</h2>
            <p className="desc">{tt('여러 개 골라도 돼요. 고른 언어 문장이 섞여서 나와요.')}</p>
            <div className="lg-grid ob-grid">
              {LANGS.filter((l) => l.code !== state.native).map((l) => {
                const on = state.learn.includes(l.code);
                return (
                  <button key={l.code} className={on ? 'on' : ''} onClick={() => toggleLearn(l.code)}>
                    <Code c={l.code} /><span className="nm">{l.ko}<small>{l.name}</small></span><span className="ck">{on && <Icon name="check" />}</span>
                  </button>
                );
              })}
            </div>
          </>
        )}
        {step === 3 && (
          <>
            <h2 className="title">{[tt('파란 단어를 눌러 보세요'), tt('카드를 두 번 톡톡 눌러 저장해요'), tt('잘했어요! 문장을 저장했어요')][guide - 1]}</h2>
            <p className="desc">{[tt('모르는 단어는 눌러서 뜻을 바로 확인해요.'), tt('마음에 드는 문장은 배울래요에 모아 두고 복습해요.'), tt('저장한 문장은 배울래요 탭에서 다시 볼 수 있어요.')][guide - 1]}</p>
            <div className="ob-missions">
              <span className={tapped ? 'fin' : 'now'}><i>{tapped ? '✓' : 1}</i>{tt('단어 누르기')}</span>
              <span className={saved ? 'fin' : tapped ? 'now' : ''}><i>{saved ? '✓' : 2}</i>{tt('두 번 탭해서 저장')}</span>
            </div>
            {practiceCard(false)}
            {guide === 2 && <div className="ob-coach"><b>{tt('카드 아무 곳이나 톡톡 두 번')}</b><small>{tt('오른쪽 저장 아이콘을 눌러도 돼요')}</small></div>}
            {guide === 3 && <div className="ob-saved"><Icon name="check" />{tt('배울래요에 저장했어요')}</div>}
          </>
        )}
        {step === 4 && (
          <>
            <h2 className="title">{tt('잊을 때쯤 다시')}<br />{tt('보여 드려요')}</h2>
            <p className="desc">{tt('기억이 날수록 간격이 길어지고, 헷갈리면 다시 짧아져요.')}</p>
            <div className="ob-card ob-line">
              <p className="ob-cap">{tt('저장한 문장은 이렇게 돌아와요')}</p>
              {TIMELINE.map(([d, t, s]) => (
                <div key={d}><em>{d}</em><u /><span><b>{t}</b><small>{s}</small></span></div>
              ))}
            </div>
            <div className="ob-info"><Icon name="info" /><span><b>{tt('복습은 배울래요 탭에서 시작해요')}</b><small>{tt('하루 몇 문장만 가볍게 해도 충분해요')}</small></span></div>
          </>
        )}
        {step === 5 && <div className="rv-card" style={{ position: 'relative' }}>{practiceCard(true)}</div>}
        {step === 6 && (
          <div className="ob-done">
            <div className="ok"><Icon name="check" style={{ width: 44, height: 44, stroke: '#fff', strokeWidth: 2.5 }} /></div>
            <h2 className="title">{tt('준비 끝! 이제 시작해요')}</h2>
            <p className="desc">{tt('앞으로는 이렇게 쓰면 돼요.')}</p>
            {RECAP.map(([ic, t, s]) => (
              <div className="ob-row" key={t}><span><Icon name={ic} /></span><div><b>{t}</b><small>{s}</small></div></div>
            ))}
          </div>
        )}
      </div>
      <div className="bottom rv-card" style={{ textAlign: 'center' }}>
        {step === 1 && <button className="ob-go" onClick={() => setStep(2)}>{ask[3]}</button>}
        {step === 2 && (
          <>
            {sample && (
              <div className="ob-pv" key={sample.id}>
                <span className="cap"><Code c={sample.lang} />{tt('이런 문장이 나와요')}</span>
                <b lang={langTag(sample.lang)}>{sentence(sample)}</b>
                <small>{tr}</small>
              </div>
            )}
            <Button disabled={!n} onClick={() => setStep(3)}>{n ? tt('{n}개 언어로 시작하기', { n }) : tt('배울 언어를 골라 주세요')}</Button>
            <p className="ob-foot" style={{ marginTop: 10 }}>{tt('언어는 \'마이\' 탭에서 언제든 바꿀 수 있어요')}</p>
          </>
        )}
        {step === 3 && (
          <>
            <p className={`ob-foot${guide === 3 ? ' fin' : ''}`}>{tt(['단어를 누르면 다음 미션이 열려요 · 0 / 2', '한 번만 더 하면 끝나요 · 1 / 2', '미션 완료 · 2 / 2'][guide - 1])}</p>
            <Button disabled={!(tapped && saved)} onClick={() => setStep(4)}>{tt('다음')}</Button>
          </>
        )}
        {step === 4 && <Button onClick={() => setStep(5)}>{tt('복습 해 보기')}</Button>}
        {step === 5 && (
          <>
            <span className="ob-bubble tip">{tt('하나를 골라 보세요')}</span>
            <div className="ans-row">
              <FaceButton kind="again" label={tt('다시 볼래요')} sub={tt('내일')} onClick={() => setStep(6)} />
              <FaceButton kind="good" label={tt('기억나요')} sub={tt('3일 뒤')} onClick={() => setStep(6)} />
            </div>
          </>
        )}
        {step === 6 && <Button onClick={finish}>{tt('첫 카드 보러 가기')}</Button>}
        {(step === 3 || step === 4 || step === 5) && <Button kind="link" style={{ marginTop: -4 }} onClick={finish}>{tt('건너뛰기')}</Button>}
      </div>
    </section>
  );
}
