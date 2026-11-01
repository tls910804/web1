import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react';

type Kind = 'dark' | 'light' | 'line' | 'link' | 'danger';

interface Props extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'> {
  kind?: Kind;
  /** 너비를 내용에 맞춘다 (기본은 가로 가득) */
  auto?: boolean;
  children: ReactNode;
}

export function Button({ kind = 'dark', auto, style, children, ...rest }: Props) {
  const s: CSSProperties | undefined = auto ? { width: 'auto', ...style } : style;
  return <button className={`btn ${kind}`} style={s} {...rest}>{children}</button>;
}

export function IconButton({ label, extra, children, style, ...rest }: { label: string; extra?: string; children: ReactNode } & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'aria-label'>) {
  return <button className={`ib${extra ? ' ' + extra : ''}`} aria-label={label} style={style} {...rest}>{children}</button>;
}

export function Chip({ on, children, ...rest }: { on?: boolean; children: ReactNode } & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'>) {
  return <button className={`chip${on ? ' on' : ''}`} {...rest}>{children}</button>;
}
