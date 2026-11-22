import { useEffect, useRef, useState } from 'react';
import { tt } from '../i18n';
import { Button } from '../components/Button';
import { SheetHead } from '../components/Layer';
import { streakOf } from '../lib/srs';
import { sentence, trOf } from '../lib/text';
import { useStore } from '../store';
import { useUi } from '../ui';
import type { Card } from '../types';

/** 공유 카드 배경 3가지 (시안 15) */
const BGS: [string, string][] = [['#7b8cff', '#c77dff'], ['#2b3240', '#454d5c'], ['#ffd29a', '#ff9aa8']];
const W = 1080, H = 1920;

/** 너비에 맞게 줄 나누기. 띄어쓰기 없는 언어는 글자 단위로 */
function wrap(ctx: CanvasRenderingContext2D, text: string, max: number) {
  const parts = /\s/.test(text) ? text.split(/(\s+)/) : [...text];
  const lines: string[] = [];
  let cur = '';
  for (const p of parts) {
    if (cur && ctx.measureText(cur + p).width > max) { lines.push(cur.trim()); cur = p.trimStart(); } else cur += p;
  }
  if (cur.trim()) lines.push(cur.trim());
  return lines;
}

/** 오늘의 문장을 인스타 스토리 크기(1080×1920) 이미지로 그려요 */
export function drawShare(canvas: HTMLCanvasElement, s: string, tr: string, day: number, bg: number) {
  const ctx = canvas.getContext('2d')!;
  canvas.width = W; canvas.height = H;
  const [a, b] = BGS[bg];
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, a); g.addColorStop(1, b);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const font = getComputedStyle(document.body).fontFamily;
  const ink = bg === 2 ? '#3a2330' : '#ffffff';
  ctx.fillStyle = ink; ctx.textBaseline = 'top';
  const X = 110, MAX = W - 2 * X;
  if (day > 0) { ctx.font = `700 46px ${font}`; ctx.fillText(`DAY ${day}`, X, 200); }
  // 문장: 6줄 안에 들어갈 때까지 글자를 줄여요
  let size = 132, lines: string[] = [];
  for (; size > 56; size -= 8) { ctx.font = `800 ${size}px ${font}`; lines = wrap(ctx, s, MAX); if (lines.length <= 6) break; }
  const lh = size * 1.12;
  ctx.font = `600 54px ${font}`;
  const trLines = wrap(ctx, tr, MAX).slice(0, 4);
  const blockH = lines.length * lh + 50 + trLines.length * 72;
  let y = Math.max(360, (H - blockH) / 2 - 40);
  ctx.font = `800 ${size}px ${font}`;
  for (const l of lines) { ctx.fillText(l, X, y); y += lh; }
  y += 50;
  ctx.globalAlpha = 0.9; ctx.font = `500 54px ${font}`;
  for (const l of trLines) { ctx.fillText(l, X, y); y += 72; }
  ctx.globalAlpha = 0.75; ctx.font = `500 40px ${font}`;
  ctx.fillText(tt('문장 쇼츠 · 매일 한 문장'), X, H - 220);
  ctx.globalAlpha = 1;
}

const toBlob = (c: HTMLCanvasElement) => new Promise<Blob | null>((r) => c.toBlob(r, 'image/png'));

/** 공유 카드 시트: 배경 고르기 → 휴대폰 공유 창(인스타 스토리·카톡 등) 또는 이미지 저장 */
export function ShareSheet({ card }: { card: Card }) {
  const { state } = useStore();
  const { toast } = useUi();
  const [bg, setBg] = useState(0);
  const [url, setUrl] = useState('');
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const cv = () => (canvas.current ??= document.createElement('canvas')); // 처음 쓸 때 한 번만 만든다
  const s = sentence(card), tr = trOf(card.tr, state.native);
  useEffect(() => {
    drawShare(cv(), s, tr, streakOf(state.log), bg);
    setUrl(cv().toDataURL('image/png'));
  }, [s, tr, bg, state.log]);

  const save = async () => {
    const blob = await toBlob(cv());
    if (!blob) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'langshort-card.png'; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast(tt('이미지를 저장했어요'));
  };
  const share = async () => {
    const blob = await toBlob(cv());
    if (!blob) return;
    const file = new File([blob], 'langshort-card.png', { type: 'image/png' });
    if (navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file], text: s }); } catch { /* 사용자가 공유 창을 닫음 */ }
    } else save(); // 공유 창이 없는 브라우저(대부분 데스크톱)는 저장으로
  };

  return (
    <div className="sh-sheet">
      <SheetHead title={tt('공유 카드')} />
      {url && <img className="sh-prev" src={url} alt={s} />}
      <div className="sh-bgs" role="radiogroup" aria-label={tt('배경')}>
        {BGS.map(([a, b], i) => (
          <button key={i} role="radio" aria-checked={bg === i} className={bg === i ? 'on' : ''} style={{ background: `linear-gradient(135deg,${a},${b})` }} onClick={() => setBg(i)} />
        ))}
      </div>
      <Button kind="dark" onClick={share}>{tt('공유하기')}</Button>
      <Button kind="line" onClick={save}>{tt('이미지 저장')}</Button>
    </div>
  );
}
