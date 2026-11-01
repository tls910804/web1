import type { ReactNode } from 'react';
import { useUi } from '../ui';
import { Button, IconButton } from './Button';
import { Icon } from './Icon';

/** 시트 · 대화상자를 화면 위에 띄우는 층 */
export function Layer() {
  const { layer, closeLayer } = useUi();
  if (!layer) return <div id="layer" />;
  if (layer.kind === 'sheet') {
    return (
      <div id="layer">
        <div className="scrim" onClick={closeLayer} />
        <section className="sheet" role="dialog" aria-modal="true">{layer.node}</section>
      </div>
    );
  }
  return (
    <div id="layer">
      <div className="scrim" />
      <section className="dialog" role="alertdialog" aria-modal="true">
        <h3>{layer.title}</h3>
        <p>{layer.body}</p>
        <div className="acts2">
          {layer.actions.map((a, i) => (
            <Button key={i} kind={a.kind || 'light'} onClick={() => { closeLayer(); a.fn?.(); }}>{a.label}</Button>
          ))}
        </div>
      </section>
    </div>
  );
}

export function SheetHead({ title }: { title: string }) {
  const { closeLayer } = useUi();
  return (
    <>
      <div className="grab" />
      <div className="sh-head"><h3>{title}</h3><IconButton label="닫기" onClick={closeLayer}><Icon name="close" /></IconButton></div>
    </>
  );
}

export const Grab = () => <div className="grab" />;
export const Lbl = ({ children, small }: { children: ReactNode; small?: string }) => <span className="lbl">{children}{small && <small>{small}</small>}</span>;
