import type { CSSProperties } from 'react';
import { ICON } from '../constants';

// ICON 상수는 코드 안에 고정된 svg 경로라서 그대로 넣어도 안전하다.
export function Icon({ name, style }: { name: keyof typeof ICON; style?: CSSProperties }) {
  return <svg className="i" viewBox="0 0 24 24" style={style} dangerouslySetInnerHTML={{ __html: ICON[name] }} />;
}
