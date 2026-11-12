import { FONT_SIZES, MODES, THEMES } from '../constants';
import { tt } from '../i18n';
import { Icon } from '../components/Icon';
import { Note } from '../components/Rows';
import { notifySummary } from '../lib/notify';
import { lang } from '../lib/text';
import { useActions } from '../lib/useActions';
import { useStore } from '../store';
import { useUi } from '../ui';
import { callsToday } from './Call';
import { LANGS } from '../data';
import { SheetHead } from '../components/Layer';
import { useLangPick } from './LangPickers';

export const accountName = (account: string | null) => (account ? tt('{a} 계정', { a: account }) : tt('로그인하지 않음'));

type IconName = Parameters<typeof Icon>[0]['name'];
const FREE_CALLS = 3;
const LANG_COLOR: Record<string, string> = { en: '#2563eb', ko: '#0ea5e9', ja: '#e11d48', zh: '#d97706', es: '#16a34a', fr: '#7c5cff', de: '#0f766e', pt: '#65a30d', ru: '#9333ea', vi: '#dc2626', id: '#ea580c' };
const Code = ({ c }: { c: string }) => {
  const col = LANG_COLOR[c] || '#6b7078';
  return <span className="lg-code" style={{ color: col, background: `color-mix(in srgb, ${col} 13%, transparent)` }}>{c.toUpperCase()}</span>;
};

/** 내 언어(하나) · 배울 언어(여러 개) 고르는 시트 */
function LangSheet() {
  const { state } = useStore();
  const { closeLayer } = useUi();
  const { setNative, toggleLearn } = useLangPick();
  const learnKo = state.learn.map((c) => lang(c).ko).join(', ');
  return (
    <div className="lg-sheet">
      <SheetHead title={tt('언어 설정')} />
      <p className="lg-sum">{tt('뜻은')} <b>{lang(state.native).ko}</b>{tt('로, 문장은')} <b className="b">{learnKo}</b>{tt('로 나와요')}</p>
      <div className="lg-h"><span className="n">1</span><b>{tt('내 언어')}</b></div>
      <small className="lg-s">{tt('뜻과 설명이 이 언어로 나와요 · 하나만')}</small>
      <div className="lg-nat">
        {[...LANGS].sort((a, b) => +(b.code === state.native) - +(a.code === state.native)).map((l) => (
          <button key={l.code} className={l.code === state.native ? 'on' : ''} onClick={() => setNative(l.code)}>
            {l.code === state.native && <Icon name="check" />}{l.ko}
          </button>
        ))}
      </div>
      <div className="lg-h"><span className="n b">2</span><b>{tt('배울 언어')}</b></div>
      <small className="lg-s">{tt('이 언어 문장이 나와요 · 여러 개 골라도 돼요')}</small>
      <div className="lg-grid">
        {LANGS.filter((l) => l.code !== state.native).map((l) => {
          const on = state.learn.includes(l.code);
          return (
            <button key={l.code} className={on ? 'on' : ''} onClick={() => toggleLearn(l.code)}>
              <Code c={l.code} /><span className="nm">{l.ko}</span><span className="ck">{on && <Icon name="check" />}</span>
            </button>
          );
        })}
      </div>
      <button className="lg-done" onClick={closeLayer}>{tt('완료')}</button>
    </div>
  );
}

/** 색 아이콘 + 이름 + 지금 값(아래 줄) */
function Item({ icon, color, label, value, onClick }: { icon: IconName; color: string; label: string; value: string; onClick: () => void }) {
  return (
    <button className="my-item" onClick={onClick}>
      <span className="my-ic" style={{ color, background: `color-mix(in srgb, ${color} 13%, transparent)` }}><Icon name={icon} /></span>
      <span className="my-tx"><b>{label}</b><small>{value}</small></span>
      <span className="my-chev"><Icon name="chev" /></span>
    </button>
  );
}

/** 마이 탭 (예전 설정 탭) */
export function Settings() {
  const { state, set } = useStore();
  const { openSub, go, toast, openSheet } = useUi();
  const { openLogin } = useActions();
  const dark = state.theme === 'system' ? !!window.matchMedia?.('(prefers-color-scheme: dark)').matches : state.theme === 'dark';
  const used = Math.min(callsToday(), FREE_CALLS);
  const soon = () => toast(tt('프리미엄은 준비 중이에요'));
  return (
    <section className="screen"><div className="page my">
      <h2 className="title" style={{ marginBottom: 14 }}>{tt('마이')}</h2>
      {state.account ? (
        <button className="profile" onClick={() => openSub('account')}>
          <span className="avatar">{state.account[0]}</span>
          <span style={{ flex: 1, minWidth: 0 }}><b>{accountName(state.account)}</b><span>{tt('데모 로그인 · 이 기기에 저장')}</span></span><span className="my-chev"><Icon name="chev" /></span>
        </button>
      ) : (
        <button className="profile" onClick={openLogin}>
          <span className="avatar"><Icon name="user" style={{ width: 22, height: 22, stroke: 'var(--blue)' }} /></span>
          <span style={{ flex: 1, minWidth: 0 }}><b>{tt('로그인하기')}</b><span>{tt('다른 기기에서도 이어서 볼 수 있어요')}</span></span><span className="my-chev"><Icon name="chev" /></span>
        </button>
      )}

      <button className="my-card my-lang" onClick={() => openSheet(<LangSheet />)}>
        <span className="hd"><b>{tt('언어')}</b><span className="ed">{tt('바꾸기')}<Icon name="chev" /></span></span>
        <span className="pair">
          <span className="nat"><small>{tt('내 언어')}</small><b>{lang(state.native).ko}</b></span>
          <span className="arr"><Icon name="back" /></span>
          <span className="lrn"><small>{tt('배울 언어')}</small><span className="chips">{state.learn.map((c) => <span key={c}>{lang(c).ko}</span>)}</span></span>
        </span>
      </button>

      {/* shortcut: 결제가 아직 없어서 버튼은 안내만 띄움, 결제 붙일 때 연결 */}
      <div className="my-pro">
        <div className="top"><span className="lb">PREMIUM</span><span className="pill">{tt('첫 달 50% 할인')}</span></div>
        <h3>{tt('AI 전화는 무제한,')}<br />{tt('문장은 끝까지')}</h3>
        <ul>
          {[tt('AI 전화 하루 3번 제한 없이'), tt('쇼츠 영상 전체 열기'), tt('광고 없이 공부만')].map((s) => (
            <li key={s}><span className="ck"><Icon name="check" /></span>{s}</li>
          ))}
        </ul>
        <div className="bot">
          <div className="price"><s>9,900원</s><b>4,950</b><small>{tt('원 / 첫 달')}</small></div>
          <button onClick={soon}>{tt('시작하기')}</button>
        </div>
      </div>

      {/* shortcut: 횟수만 세고 막지는 않음, 프리미엄 붙일 때 제한 추가 */}
      <div className="my-card">
        <div className="my-use"><b>{tt('오늘 남은 AI 전화')}</b><span>{FREE_CALLS - used} / {FREE_CALLS}{tt('회')}</span></div>
        <div className="my-bar"><i style={{ width: `${((FREE_CALLS - used) / FREE_CALLS) * 100}%` }} /></div>
        <small>{tt('무료는 하루 3번까지 · 프리미엄은 무제한')}</small>
      </div>

      <div className="group-t">{tt('바로 바꾸기')}</div>
      <div className="my-quick">
        <button onClick={() => set({ auto: !state.auto })}>
          <span className="top"><span className="my-ic" style={{ color: '#2563eb', background: 'color-mix(in srgb, #2563eb 13%, transparent)' }}><Icon name="skip" /></span><span className={`switch${state.auto ? ' on' : ''}`} /></span>
          <b>{tt('자동재생')}</b><small>{state.auto ? tt('켜짐 · 다음 문장으로') : tt('꺼짐 · 직접 넘기기')}</small>
        </button>
        <button onClick={() => set({ theme: dark ? 'light' : 'dark' })}>
          <span className="top"><span className="my-ic" style={{ color: '#7c5cff', background: 'color-mix(in srgb, #7c5cff 13%, transparent)' }}><Icon name="moon" /></span><span className={`switch${dark ? ' on' : ''}`} /></span>
          <b>{tt('다크 모드')}</b><small>{dark ? tt('켜짐 · 어두운 화면') : tt('꺼짐 · 밝은 화면')}</small>
        </button>
      </div>

      <div className="group-t">{tt('학습')}</div>
      <div className="my-card list">
        <Item icon="book" color="#16a34a" label={tt('학습 방식')} value={`${state.auto ? tt('자동재생') : tt('수동')} · ${tt(MODES[state.mode].name)}`} onClick={() => openSub('learn')} />
        <Item icon="bell" color="#f97316" label={tt('알림')} value={notifySummary(state)} onClick={() => openSub('notify')} />
      </div>
      <div className="group-t">{tt('화면 · 데이터')}</div>
      <div className="my-card list">
        <Item icon="screen" color="#7c5cff" label={tt('화면')} value={`${tt(FONT_SIZES[state.fontSize].name)} · ${tt(THEMES[state.theme])}`} onClick={() => openSub('display')} />
        <Item icon="download" color="#0d9488" label={tt('데이터')} value={state.lastBackup ? tt('백업함') : tt('마지막 백업 없음 · 백업하기')} onClick={() => openSub('data')} />
      </div>
      <div className="group-t">{tt('기타')}</div>
      <div className="my-card list">
        {/* 임시: 온보딩 확인용, 나중에 지운다 */}
        <Item icon="undo" color="#6b7078" label={tt('처음 화면 다시 보기')} value={tt('언어 고르기부터 다시 시작')} onClick={() => go('onboarding')} />
      </div>
      <Note>{tt('문장 쇼츠 · 외국어 문장과 뜻은 아직 원어민 검수 전이에요.')}</Note>
    </div></section>
  );
}
