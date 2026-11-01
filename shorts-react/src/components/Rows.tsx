import type { ReactNode } from 'react';
import { Icon } from './Icon';

interface RowProps {
  label: string;
  value?: string;
  sub?: string;
  onClick?: () => void;
  red?: boolean;
  disabled?: boolean;
  noChev?: boolean;
}

export function Row({ label, value, sub, onClick, red, disabled, noChev }: RowProps) {
  return (
    <button className={`row${red ? ' red' : ''}`} onClick={onClick} disabled={disabled}>
      <span className="lb">{label}{sub && <small>{sub}</small>}</span>
      {value && <em>{value}</em>}
      {!noChev && <Icon name="chev" style={{ width: 18, height: 18, stroke: 'var(--icon)', flex: 'none' }} />}
    </button>
  );
}

export function ToggleRow({ label, sub, on, onClick, disabled }: { label: string; sub?: string; on: boolean; onClick: () => void; disabled?: boolean }) {
  return (
    <button className="row" onClick={onClick} disabled={disabled}>
      <span className="lb">{label}{sub && <small>{sub}</small>}</span>
      <span className={`switch${on ? ' on' : ''}`} />
    </button>
  );
}

export const Group = ({ children, style }: { children: ReactNode; style?: React.CSSProperties }) => <div className="group" style={style}>{children}</div>;
export const Pill = ({ children }: { children: ReactNode }) => <span className="pill">{children}</span>;
export const Note = ({ children }: { children: ReactNode }) => <p className="note">{children}</p>;

/** 핵심 표현 + 뜻 블록 (왼쪽 파란 막대) */
export function Expr({ text, mean }: { text: string; mean: string }) {
  return (
    <div className="expr"><i /><div><b>{text}</b><span>{mean || '뜻을 아직 적지 않았어요'}</span></div></div>
  );
}
