import { tt } from '../i18n';
import { LEVELS } from '../constants';
import { Button, Chip, IconButton } from '../components/Button';
import { Icon } from '../components/Icon';
import { Grab, Lbl, SheetHead } from '../components/Layer';
import { Group, Pill } from '../components/Rows';
import { useActions } from '../lib/useActions';
import { langTag, sentence, trOf, wordInfo } from '../lib/text';
import { useStore } from '../store';
import { useUi } from '../ui';
import type { Card } from '../types';

export function WordSheet({ card, wi }: { card: Card; wi: number }) {
  const { state } = useStore();
  const { speak, closeLayer } = useUi();
  const { findSaved, toggleSave } = useActions();
  const info = wordInfo(card, wi, state.native);
  const saved = !!findSaved('w', card, wi);
  return (
    <>
      <Grab />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <h3 className="big" lang={langTag(card.lang)}>{info.text}</h3><Pill>{info.expr ? tt('표현') : tt('단어')}</Pill>
        <IconButton label={tt('발음 듣기')} style={{ marginLeft: 'auto' }} onClick={() => speak(info.speak, card.lang)}><Icon name="speak" /></IconButton>
      </div>
      <div className="mean">{info.mean || tt('뜻을 아직 적지 않았어요')}</div>
      <div className="ctx"><b>{tt('이 문장에서')}</b>{sentence(card)} ({trOf(card.tr, state.native)})</div>
      <div style={{ display: 'flex', gap: 10 }}>
        <Button kind="dark" style={{ flex: 1 }}
          onClick={() => { closeLayer(); toggleSave('w', card, wi); }}>
          <Icon name="mark" style={saved ? { fill: 'currentColor' } : undefined} />{saved ? tt('저장됨') : tt('배울래요')}
        </Button>
        <Button kind="light" auto onClick={closeLayer}>{tt('닫기')}</Button>
      </div>
    </>
  );
}

export function AutoSheet() {
  const { state, set } = useStore();
  const { closeLayer } = useUi();
  return (
    <>
      <SheetHead title={tt('자동재생')} />
      <Group style={{ margin: 0 }}>
        <button className="row" onClick={() => set({ auto: !state.auto })}><span className="lb">{tt('자동재생')}<small>{tt('카드를 넘기면 발음이 바로 나와요')}</small></span><span className={`switch${state.auto ? ' on' : ''}`} /></button>
        <button className="row" onClick={() => set({ slow: !state.slow })}><span className="lb">{tt('천천히 듣기')}<small>{tt('발음을 조금 느리게 들려줘요')}</small></span><span className={`switch${state.slow ? ' on' : ''}`} /></button>
      </Group>
      <Lbl>{tt('반복')}</Lbl>
      <div className="grid">{[1, 2, 3].map((n) => <Chip key={n} on={state.autoRepeat === n} onClick={() => set({ autoRepeat: n })}>{tt('{n}번', { n })}</Chip>)}</div>
      <Button kind="dark" onClick={closeLayer}>{tt('완료')}</Button>
    </>
  );
}

export function LevelSheet() {
  const { state, set } = useStore();
  const { closeLayer } = useUi();
  return (
    <>
      <SheetHead title={tt('난이도')} />
      <p className="desc" style={{ margin: 0 }}>{tt('둘러보기에 나올 문장의 난이도예요. 직접 추가한 문장은 항상 보여요.')}</p>
      {LEVELS.map((l) => (
        <button key={l} className={`opt${state.level === l ? ' on' : ''}`} style={{ margin: 0 }} onClick={() => { set({ level: l }); closeLayer(); }}>
          <span className="rd" /><span><b>{tt(l)}</b></span>
        </button>
      ))}
    </>
  );
}

export function NotifyPrompt({ then }: { then?: () => void }) {
  const { set } = useStore();
  const { closeLayer, toast } = useUi();
  const allow = () => {
    closeLayer();
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().then((r) => {
        if (r === 'granted') { set({ notify: { morning: true, evening: true } }); toast(tt('알림을 켰어요')); }
        else toast(tt('알림은 설정에서 다시 켤 수 있어요'));
        then?.();
      });
    } else then?.();
  };
  const later = () => { closeLayer(); then?.(); };
  return (
    <>
      <Grab />
      <div className="em-ico" style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--blue-tint)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="bell" style={{ width: 26, height: 26, stroke: 'var(--blue)' }} />
      </div>
      <h3>{tt('매일 한 문장, 알림으로 받을래요?')}</h3>
      <p style={{ margin: '-6px 0 2px', fontSize: 14, color: 'var(--muted)', lineHeight: 1.55 }}>{tt('아침에 오늘의 문장을, 저녁엔 복습할 게 있을 때만 알려 드려요. 설정에서 언제든 끌 수 있어요.')}</p>
      <Button kind="dark" onClick={allow}>{tt('알림 받기')}</Button>
      <Button kind="link" onClick={later}>{tt('나중에')}</Button>
    </>
  );
}

