import { useState } from 'react';
import { NO_SPACE } from '../constants';
import { Button, Chip, IconButton } from '../components/Button';
import { Icon } from '../components/Icon';
import { Lbl } from '../components/Layer';
import { newItem } from '../lib/useActions';
import { lang } from '../lib/text';
import { useStore } from '../store';
import { useUi } from '../ui';
import type { Card } from '../types';

export function Add() {
  const { state, set } = useStore();
  const { go, toast, setSavedTab, setSavedFilter } = useUi();
  const [code, setCode] = useState(state.learn[0] || "en");
  const [text, setText] = useState('');
  const [tr, setTr] = useState('');
  const [mean, setMean] = useState('');
  const [sel, setSel] = useState<number[]>([]);

  const trimmed = text.trim();
  const joiner = NO_SPACE[code] && !text.includes(' ') ? '' : ' ';
  const tokens = !trimmed ? [] : NO_SPACE[code] && !trimmed.includes(' ') ? Array.from(trimmed) : trimmed.split(/\s+/);
  const picked = sel.filter((i) => i < tokens.length).sort((a, b) => a - b);
  const expr = picked.map((i) => tokens[i]).join(joiner).replace(/[.,!?。、！？]+$/, '');

  const toggleWord = (i: number) => setSel((s) => (s.includes(i) ? s.filter((x) => x !== i) : [...s, i]));

  const save = () => {
    if (!tokens.length || !tr.trim()) return;
    const card: Card = {
      id: `c${Date.now()}`, lang: code, cat: '내 문장', words: tokens, key: picked, expr,
      tr: { [state.native]: tr.trim() }, mean: mean.trim() ? { [state.native]: mean.trim() } : {},
    };
    set((s) => ({
      custom: [...s.custom, card],
      saved: [...(expr ? [newItem('w', card, -1, s.native)] : []), newItem('s', card, -1, s.native), ...s.saved],
    }));
    setSavedTab('s'); setSavedFilter('learning');
    go('saved');
    toast('내 문장을 저장했어요');
  };

  return (
    <section className="screen glow">
      <div className="page">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
          <h2 className="title" style={{ margin: 0 }}>문장 추가</h2>
          <IconButton label="닫기" onClick={() => go('saved')}><Icon name="close" /></IconButton>
        </div>
        <p className="desc" style={{ marginTop: 6 }}>드라마·수업·대화에서 만난 문장을 내 카드로 저장해요</p>
        <Lbl>배우는 언어</Lbl>
        <div className="grid">{state.learn.map((c) => <Chip key={c} on={c === code} onClick={() => { setCode(c); setSel([]); }}>{lang(c).name}</Chip>)}</div>
        <label className="lbl" htmlFor="add-text">문장</label>
        <textarea className="field" id="add-text" rows={2} placeholder="I'm running late, be there in ten." value={text} onChange={(e) => setText(e.target.value)} />
        <label className="lbl" htmlFor="add-tr">해석<small>{lang(state.native).ko}</small></label>
        <textarea className="field" id="add-tr" rows={1} placeholder="좀 늦어, 10분 안에 갈게." value={tr} onChange={(e) => setTr(e.target.value)} />
        <Lbl small="선택 · 단어를 눌러 묶어요">핵심 표현</Lbl>
        <div className="words sm">
          {tokens.length
            ? tokens.map((t, i) => <button key={i} className={`w${picked.includes(i) ? ' key' : ''}`} onClick={() => toggleWord(i)}>{t}</button>)
            : <span className="desc">문장을 입력하면 단어가 나타나요</span>}
        </div>
        {expr && (
          <div className="expr" style={{ marginTop: 14 }}>
            <i />
            <div style={{ flex: 1 }}><b>{expr}</b>
              <input className="field" style={{ marginTop: 6, fontSize: 14, padding: '8px 12px' }} placeholder="뜻을 직접 적어요 (예: 예정보다 늦어지고 있다)" value={mean} onChange={(e) => setMean(e.target.value)} />
            </div>
          </div>
        )}
      </div>
      <div className="bottom"><Button kind="dark" disabled={!tokens.length || !tr.trim()} onClick={save}>배울래요에 저장</Button></div>
    </section>
  );
}
