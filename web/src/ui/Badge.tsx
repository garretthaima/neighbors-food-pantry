import type { ReactNode } from 'react';

export type BadgeTone = 'neutral' | 'success' | 'danger' | 'warning' | 'tag';

interface Props {
  tone?: BadgeTone;
  children: ReactNode;
}

/** A small status pill. The text carries the meaning; colour only reinforces it. */
export function Badge({ tone = 'neutral', children }: Props) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}
