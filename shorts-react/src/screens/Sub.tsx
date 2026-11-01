import { useRef, type ChangeEvent } from 'react';
import { FONT_SIZES, MODES, THEMES } from '../constants';
import { IconButton } from '../components/Button';
import { Icon } from '../components/Icon';
import { Group, Note, Row, ToggleRow } from '../components/Rows';
import { Lbl } from '../components/Layer';
import { notifPerm } from '../lib/notify';
import { useActions } from '../lib/useActions';
import { allCards } from '../lib/feed';
import { useStore } from '../store';
import { useUi } from '../ui';
import type { AppState, FontKey, ModeKey, ThemeKey } from '../types';
import { LangPickers } from './LangPickers';
import { accountName } from './Settings';
import { LevelSheet } from './Sheets';

function Header({ title }: { title: string }) {
  const { goBack } = useUi();
  return <div className="hdr"><IconButton label="뒤로" onClick={goBack}><Icon name="back" /></IconButton><h2>{title}</h2></div>;
}

export function Sub() {
  const { state, set, replace } = useStore();
  const ui = useUi();
  const { sub, openSub, openDialog, openSheet, toast, go } = ui;
  const { exportData } = useActions();
  const fileRef = useRef<HTMLInputElement>(null);

  const setNotify = (key: 'morning' | 'evening') => {
    const p = notifPerm();
    if (state.notify[key]) { set({ notify: { ...state.notify, [key]: false } }); return; }
    if (p === 'granted') { set({ notify: { ...state.notify, [key]: true } }); return; }
    if (p === 'default') {
      Notification.requestPermission().then((r) => { if (r === 'granted') set((s) => ({ notify: { ...s.notify, [key]: true } })); });
    }
  };

  const onImport = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      let data: Partial<AppState> | null;
      try { data = JSON.parse(String(r.result)); } catch { data = null; }
      if (!data || !Array.isArray(data.saved) || !Array.isArray(data.learn)) {
        openDialog('가져오지 못했어요', '문장 쇼츠에서 내보낸 파일이 아니거나 파일이 손상됐어요.', [{ label: '확인', kind: 'dark' }]);
        return;
      }
      const incoming = data;
      openDialog('데이터를 가져올까요?', `저장한 항목 ${incoming.saved!.length}개를 가져와요. 지금 이 기기의 데이터는 파일 내용으로 바뀌어요.`, [
        { label: '취소', kind: 'light' },
        { label: '가져오기', kind: 'dark', fn: () => { replace({ ...state, ...incoming } as AppState); toast('데이터를 가져왔어요'); go('settings'); } },
      ]);
    };
    r.readAsText(f);
  };

  const deleteAccount = () => openDialog('계정을 삭제할까요?', '저장한 문장, 복습 기록, 설정이 이 기기에서 모두 지워져요. 되돌릴 수 없어요.', [
    { label: '취소', kind: 'light' },
    { label: '삭제', kind: 'danger', fn: () => { try { localStorage.removeItem('sentence-shorts-v1'); } catch { /* 무시 */ } location.reload(); } },
  ]);

  const logout = () => openDialog('로그아웃할까요?', '저장한 문장은 이 기기에 그대로 남아요.', [
    { label: '취소', kind: 'light' },
    { label: '로그아웃', kind: 'dark', fn: () => { set({ account: null }); go('settings'); toast('로그아웃했어요'); } },
  ]);

  const unhide = () => { const n = state.known.length; set({ known: [] }); toast(`숨긴 문장 ${n}개를 다시 보여줘요`); };

  let body = null;
  if (sub === 'langs') {
    const n = state.learn.length;
    body = <><Header title="언어" /><p className="desc">{n}개 언어 · 카드 {allCards(state).length}장이 섞여서 나와요</p><LangPickers /></>;
  }
  if (sub === 'learn') {
    body = (
      <><Header title="학습" />
        <Group>
          <ToggleRow label="자동재생" sub="카드를 넘기면 발음이 자동으로 나와요" on={state.auto} onClick={() => set({ auto: !state.auto })} />
          <ToggleRow label="천천히 듣기" sub="발음을 조금 느리게 들려줘요" on={state.slow} onClick={() => set({ slow: !state.slow })} />
          <Row label="복습 방식" value={MODES[state.mode].name} onClick={() => openSub('review-mode')} />
          <Row label="하루 복습 개수" value={`${state.daily}문장`} onClick={() => openSub('review-mode')} />
          <Row label="난이도" value={state.level} onClick={() => openSheet(<LevelSheet />)} />
        </Group></>
    );
  }
  if (sub === 'review-mode') {
    body = (
      <><Header title="복습 방식" />
        <p className="desc" style={{ marginBottom: 14 }}>기억한 정도에 따라 다음 복습 시점이 달라져요.</p>
        <span className="lbl" style={{ marginTop: 0 }}>복습 간격</span>
        {(Object.keys(MODES) as ModeKey[]).map((k) => (
          <button key={k} className={`opt${state.mode === k ? ' on' : ''}`} onClick={() => set({ mode: k })}>
            <span className="rd" /><span><b>{MODES[k].name}</b><span>{MODES[k].days.map((d) => (d === 1 ? '내일' : `${d}일`)).join(' → ')}</span></span>
          </button>
        ))}
        <Lbl>하루 복습 개수</Lbl>
        <div className="cnt3">{[5, 10, 20].map((n) => <button key={n} className={state.daily === n ? 'on' : ''} onClick={() => set({ daily: n })}><b>{n}</b><span>문장</span></button>)}</div>
        <Note>이미 정해진 복습 날짜는 그대로 두고, 다음 평가부터 새 간격을 써요.</Note></>
    );
  }
  if (sub === 'notify') {
    const p = notifPerm();
    const blocked = p === 'denied' || p === 'unsupported';
    body = (
      <><Header title="알림" />
        {p === 'denied' && <div className="banner warn"><Icon name="warn" /><div className="tx"><b>알림이 꺼져 있어요</b>브라우저 설정에서 이 사이트의 알림을 허용해 주세요</div></div>}
        {p === 'unsupported' && <div className="banner warn"><Icon name="warn" /><div className="tx"><b>이 브라우저는 알림을 지원하지 않아요</b>아이폰은 홈 화면에 추가하면 알림을 받을 수 있어요</div></div>}
        <Group>
          <ToggleRow label="아침 한 문장" sub="오전 8시에 오늘의 문장 1개를 보내 드려요" on={!blocked && state.notify.morning} onClick={() => setNotify('morning')} disabled={blocked} />
          <ToggleRow label="저녁 복습 알림" sub="복습할 문장이 있는 날만 오후 8시에 알려요" on={!blocked && state.notify.evening} onClick={() => setNotify('evening')} disabled={blocked} />
        </Group>
        <Note>지금은 서버 없이 브라우저만으로 동작해서, 알림 시각이 지난 뒤 앱을 열었을 때 알림을 띄워요.</Note></>
    );
  }
  if (sub === 'display') {
    body = (
      <><Header title="화면" />
        <div className="preview"><div className="words"><span className="w">Nice</span><span className="w key">to meet</span><span className="w">you.</span></div><p className="tr" style={{ marginTop: 8 }}>만나서 반가워요.</p></div>
        <Lbl>글자 크기</Lbl>
        <div className="cnt3">{(Object.keys(FONT_SIZES) as FontKey[]).map((k) => (
          <button key={k} className={state.fontSize === k ? 'on' : ''} onClick={() => set({ fontSize: k })}><b style={{ fontSize: Math.round(18 * FONT_SIZES[k].v) }}>가</b><span>{FONT_SIZES[k].name}</span></button>
        ))}</div>
        <Lbl>다크 모드</Lbl>
        <div className="cnt3">{(Object.keys(THEMES) as ThemeKey[]).map((k) => (
          <button key={k} className={state.theme === k ? 'on' : ''} onClick={() => set({ theme: k })}><b style={{ fontSize: 16 }}>{THEMES[k]}</b><span>{k === 'system' ? '기기 설정 따라' : k === 'dark' ? '어두운 화면' : '밝은 화면'}</span></button>
        ))}</div></>
    );
  }
  if (sub === 'data') {
    body = (
      <><Header title="데이터" />
        <div className="banner info"><Icon name="info" /><div className="tx"><b>이 브라우저에만 저장돼 있어요</b><span>백업해 두면 폰을 바꿔도 이어서 쓸 수 있어요</span></div></div>
        <Group>
          <Row label="파일로 내보내기" value="JSON" onClick={exportData} />
          <Row label="파일에서 가져오기" value="JSON" onClick={() => fileRef.current?.click()} />
          <Row label="'이미 알아요' 문장 다시 보기" value={`${state.known.length}개`} onClick={unhide} disabled={!state.known.length} />
        </Group>
        <Note>마지막 백업: {state.lastBackup ? new Date(state.lastBackup).toLocaleString('ko-KR') : '없음'}</Note></>
    );
  }
  if (sub === 'account') {
    body = (
      <><Header title="계정" />
        <div className="acc-head"><span className="avatar lg">{(state.account || '?')[0]}</span><b>{accountName(state.account)}</b><span>데모 로그인이라 실제 계정과 연결되지 않아요</span></div>
        <Group><Row label="로그인 방식" value={state.account || '—'} noChev /></Group>
        <Group><Row label="데이터 내보내기" value="JSON" onClick={exportData} /><Row label="데이터 가져오기" onClick={() => fileRef.current?.click()} /></Group>
        <Group><Row label="로그아웃" onClick={logout} /><Row label="계정 삭제" red onClick={deleteAccount} /></Group></>
    );
  }

  return (
    <section className="screen">
      <div className="page">{body}</div>
      <input type="file" ref={fileRef} accept="application/json,.json" hidden onChange={onImport} />
    </section>
  );
}
