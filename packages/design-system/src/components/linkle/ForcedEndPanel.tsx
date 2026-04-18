import * as React from 'react';
import { TriangleAlert } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../Card.js';
import { cn } from '../../lib/cn.js';

export interface ForcedEndPanelProps {
  reason: string;
  /** Action slot (e.g. "홈으로" button). */
  action?: React.ReactNode;
  className?: string;
}

/**
 * The panel shown when the game is terminated for a rule violation. Designed
 * so the cause is unambiguous but the tone is neutral, not punitive.
 */
export function ForcedEndPanel({ reason, action, className }: ForcedEndPanelProps) {
  return (
    <Card
      role="alert"
      className={cn('border-destructive/30 bg-destructive/5', className)}
      aria-live="assertive"
    >
      <CardHeader className="flex-row items-center gap-3 pb-2">
        <span
          aria-hidden
          className="bg-destructive/10 text-destructive grid size-10 shrink-0 place-items-center rounded-full"
        >
          <TriangleAlert size={20} />
        </span>
        <CardTitle className="text-destructive">게임이 종료되었어요</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-foreground text-sm">{reason}</p>
        {action}
      </CardContent>
    </Card>
  );
}
