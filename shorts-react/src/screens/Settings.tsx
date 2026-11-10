import { FONT_SIZES, MODES, THEMES } from '../constants';
import { tt } from '../i18n';
import { Icon } from '../components/Icon';
import { Group, Note, Row } from '../components/Rows';
import { notifySummary } from '../lib/notify';
import { lang } from '../lib/text';
import { useActions } from '../lib/useActions';
import { useStore } from '../store';
import { useUi } from '../ui';

export const accountName = (account: string | null) => (account ? tt('{a} 계정', { a: account }) : tt('로그인하지 않음'));

export function Settings() {
  const { state } = useStore();
  const { openSub, go } = useUi();
  const { openLogin } = useActions();
  const names = state.learn.map((c) => lang(c).name);
  const langVal = `${lang(state.native).ko} → ${names[0]}${names.length > 1 ? ' ' + tt('외 {n}', { n: names.length - 1 }) : ''}`;
  const chev = <Icon name="chev" style={{ width: 18, height: 18, stroke: 'var(--icon)' }} />;
  return (
    <section className="screen"><div className="page">
      <h2 className="title" style={{ marginBottom: 14 }}>{tt('설정')}</h2>
      {state.account ? (
        <button className="profile" onClick={() => openSub('account')}>
          <span className="avatar">{state.account[0]}</span>
          <span style={{ flex: 1, minWidth: 0 }}><b>{accountName(state.account)}</b><span>{tt('데모 로그인 · 이 기기에 저장')}</span></span>{chev}
        </button>
      ) : (
        <button className="profile" onClick={openLogin}>
          <span className="avatar"><Icon name="user" style={{ width: 22, height: 22, stroke: 'var(--blue)' }} /></span>
          <span style={{ flex: 1, minWidth: 0 }}><b>{tt('로그인하기')}</b><span>{tt('다른 기기에서도 이어서 볼 수 있어요')}</span></span>{chev}
        </button>
      )}
      <div className="group-t">{tt('학습')}</div>
      <Group>
        <Row label={tt('언어')} value={langVal} onClick={() => openSub('langs')} />
        <Row label={tt('학습 설정')} value={`${state.auto ? tt('자동재생') : tt('수동')} · ${tt(MODES[state.mode].name)}`} onClick={() => openSub('learn')} />
        <Row label={tt('알림')} value={notifySummary(state)} onClick={() => openSub('notify')} />
      </Group>
      <div className="group-t">{tt('화면 · 데이터')}</div>
      <Group>
        <Row label={tt('화면')} value={`${tt(FONT_SIZES[state.fontSize].name)} · ${tt(THEMES[state.theme])}`} onClick={() => openSub('display')} />
        <Row label={tt('데이터')} value={state.lastBackup ? tt('백업함') : tt('백업')} onClick={() => openSub('data')} />
      </Group>
      {/* 임시: 온보딩 확인용, 나중에 지운다 */}
      <Group><Row label={tt('온보딩 맨 앞으로 돌아가기')} onClick={() => go('onboarding')} /></Group>
      <Note>{tt('문장 쇼츠 · 외국어 문장과 뜻은 아직 원어민 검수 전이에요.')}</Note>
    </div></section>
  );
}
