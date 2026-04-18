import { ArrowRight } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../Card.js';
import { cn } from '../../lib/cn.js';

export interface ChallengeCardProps {
  startPage: string;
  endPage: string;
  /** KST date string, e.g. "2026-04-18". */
  date?: string;
  /** Total participants so far. */
  totalCount?: number;
  className?: string;
}

/**
 * Canonical "today's challenge" summary card. Appears on home and before
 * game start. Never renders its own CTA — the surrounding page decides.
 */
export function ChallengeCard({
  startPage,
  endPage,
  date,
  totalCount,
  className,
}: ChallengeCardProps) {
  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardHeader className="pb-2">
        {date ? (
          <CardDescription className="font-mono text-xs uppercase tracking-widest">
            {date}
          </CardDescription>
        ) : null}
        <CardTitle className="font-serif text-xl">오늘의 챌린지</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-3 text-lg font-semibold">
          <span className="flex-1 truncate" title={startPage}>
            {startPage}
          </span>
          <ArrowRight aria-hidden className="text-linkle" size={18} />
          <span className="text-linkle flex-1 truncate text-right" title={endPage}>
            {endPage}
          </span>
        </div>
        {typeof totalCount === 'number' ? (
          <p className="text-muted-foreground mt-3 text-xs">
            지금까지 <strong className="text-foreground">{totalCount}명</strong>이 도전했어요.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
