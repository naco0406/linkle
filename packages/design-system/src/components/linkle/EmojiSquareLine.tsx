import * as React from 'react';
import { cn } from '../../lib/cn.js';

export interface EmojiSquareLineProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Ready-to-render emoji string, e.g. "🟥🟧🟨🟩🟦⏪🏁".
   * Computed in @linkle/shared/emoji so this component stays presentational.
   */
  result: string;
  /**
   * Optional aria-label override. Defaults to "경로 유사도 요약".
   */
  label?: string;
}

/**
 * Read-only emoji sequence used for share cards and summary tiles.
 * Uses a monospace font to keep each square the same visible width across
 * platforms (emoji fonts vary wildly in advance width).
 */
export function EmojiSquareLine({
  result,
  label = '경로 유사도 요약',
  className,
  ...props
}: EmojiSquareLineProps) {
  return (
    <div
      role="img"
      aria-label={label}
      className={cn(
        'break-all text-center font-mono text-2xl leading-snug tracking-wide',
        className,
      )}
      {...props}
    >
      {result}
    </div>
  );
}
