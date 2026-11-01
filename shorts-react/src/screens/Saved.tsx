import { Button, Chip, IconButton } from '../components/Button';
import { Icon } from '../components/Icon';
import { Pill } from '../components/Rows';
import { nextDueText, dueItems, todayCount } from '../lib/srs';
import { useActions } from '../lib/useActions';
import { lang, sentence, trOf, wordInfo } from '../lib/text';
import { useStore } from '../store';
import { useUi } from '../ui';

export function Saved() {
  const { state, set } = useStore();
  const { go, savedTab, setSavedTab, savedFilter, setSavedFilter, speak, toast } = useUi();
  const { removeItem, startToday } = useActions();

  const head = (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '4px 0 12px' }}>
      <h2 className="title" style={{ margin: 0 }}>배울래요</h2>
      <button className="add-btn" onClick={() => go('add')}><Icon name="plus" style={{ width: 16, height: 16, strokeWidth: 2.2 }} />문장 추가</button>
    </div>
  );

  if (!state.saved.length) {
    return (
      <section className="screen"><div className="page">
        {head}
        <div className="empty-state">
          <div className="em-ico"><Icon name="mark" /></div>
          <b>아직 저장한 문장이 없어요</b>
          <p>둘러보기에서 단어를 누르거나 카드를 두 번 탭해서<br />마음에 드는 문장을 저장해 보세요.</p>
          <Button kind="dark" onClick={() => go('feed')}>둘러보러 가기</Button>
          <Button kind="link" onClick={() => go('add')}>직접 문장 추가하기</Button>
        </div>
      </div></section>
    );
  }

  const due = todayCount(state);
  const ofKind = state.saved.filter((x) => x.kind === savedTab);
  const learning = ofKind.filter((x) => !x.learned);
  const learned = ofKind.filter((x) => x.learned);
  const list = savedFilter === 'learning' ? learning : learned;
  const countS = state.saved.filter((x) => x.kind === 's').length;
  const countW = state.saved.length - countS;
  const waiting = dueItems(state).length - due;

  const remove = (id: string) => {
    const idx = state.saved.findIndex((x) => x.id === id);
    const gone = state.saved[idx];
    removeItem(id);
    if (gone) toast('삭제했어요', '되돌리기', () => set((s) => {
      const next = [...s.saved];
      next.splice(Math.min(idx, next.length), 0, gone);
      return { saved: next };
    }));
  };

  return (
    <section className="screen"><div className="page">
      {head}
      <div className="review-banner">
        <div style={{ flex: 1, minWidth: 0 }}>
          <b>{due ? `오늘 복습 ${due}개` : '오늘 복습은 끝났어요'}</b>
          <span>{due ? (waiting > 0 ? `하루 ${state.daily}개씩 · ${waiting}개는 다음에` : '저장한 문장·표현을 다시 떠올려 봐요') : (nextDueText(state) || '새로 저장하면 복습할 수 있어요')}</span>
        </div>
        <Button kind="dark" auto disabled={!due} style={{ minHeight: 44, padding: '10px 16px', fontSize: 14, borderRadius: 12 }} onClick={() => startToday(state)}>복습 시작</Button>
      </div>
      <div className="seg">
        <button className={savedTab === 's' ? 'on' : ''} onClick={() => setSavedTab('s')}>문장<small>{countS}</small></button>
        <button className={savedTab === 'w' ? 'on' : ''} onClick={() => setSavedTab('w')}>단어·표현<small>{countW}</small></button>
      </div>
      <p className="desc" style={{ margin: '0 0 14px' }}>외우는 중 {learning.length}개 · 외웠어요 {learned.length}개</p>
      <div className="grid" style={{ marginBottom: 8 }}>
        <Chip on={savedFilter === 'learning'} onClick={() => setSavedFilter('learning')}>외우는 중</Chip>
        <Chip on={savedFilter === 'learned'} onClick={() => setSavedFilter('learned')}>외웠어요</Chip>
      </div>
      {list.length ? list.map((x) => {
        const c = x.card;
        const info = x.kind === 'w' ? wordInfo(c, x.wi, state.native) : null;
        const headText = info ? info.text : sentence(c);
        const sub = info ? (info.mean || sentence(c)) : trOf(c.tr, state.native);
        const speakText = info ? info.speak : sentence(c);
        return (
          <div className="item" key={x.id}>
            <div className="en">{headText}<Pill>{lang(c.lang).name}</Pill></div>
            <div className="ko">{sub}</div>
            <div className="btns">
              <IconButton label="발음 듣기" onClick={() => speak(speakText, c.lang)}><Icon name="speak" /></IconButton>
              <IconButton label={x.learned ? '다시 외우기' : '외웠어요'} style={x.learned ? { background: 'var(--blue-soft)' } : undefined}
                onClick={() => set((s) => ({ saved: s.saved.map((y) => (y.id === x.id ? { ...y, learned: !y.learned, due: y.learned ? Date.now() : y.due } : y)) }))}>
                <Icon name="check" style={x.learned ? { stroke: 'var(--blue)' } : undefined} />
              </IconButton>
              <IconButton label="삭제" onClick={() => remove(x.id)}><Icon name="close" /></IconButton>
            </div>
          </div>
        );
      }) : (
        <p className="desc" style={{ padding: '24px 0', textAlign: 'center' }}>
          {savedFilter === 'learning' ? `둘러보기에서 마음에 드는 ${savedTab === 's' ? '문장을' : '표현을'} 저장해 보세요` : '아직 외운 항목이 없어요'}
        </p>
      )}
    </div></section>
  );
}
