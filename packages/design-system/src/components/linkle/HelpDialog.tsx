import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../Dialog.js';
import { cn } from '../../lib/cn.js';

export interface HelpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  className?: string;
}

/**
 * Game-rule help modal. Copy ported verbatim from the original wikirace
 * project so returning players see familiar text.
 */
export function HelpDialog({ open, onOpenChange, className }: HelpDialogProps): React.ReactElement {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn('flex max-h-[calc(100vh-4rem)] flex-col', className)}>
        <DialogHeader className="items-center text-center">
          <DialogTitle>
            <span className="text-linkle font-serif text-4xl font-normal">Linkle</span>
          </DialogTitle>
          <DialogDescription>매일 위키피디아 탐험하기</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 overflow-y-auto">
          <section className="text-foreground space-y-4 text-sm leading-relaxed">
            <p>
              <span className="text-linkle font-serif font-normal">Linkle</span>은{' '}
              <a
                href="https://en.wikipedia.org/wiki/Wikiracing"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold underline"
              >
                WikiRacing
              </a>{' '}
              게임의 규칙을 기반으로 한 한국어 위키백과 탐험 게임입니다.
            </p>
            <p>
              매일 자정, 모두에게 동일한 출발 문서와 도착 문서가 하나씩 제시됩니다.
              <br />
              출발 문서에서 시작해 문서의 하이퍼링크들을 타고 도착 문서에 도달하는 것이 목표입니다.
              <br />
              뒤로가기 버튼을 통해 직전 문서로 이동할 수 있지만 이동 횟수에 포함됩니다.
            </p>
          </section>

          <hr className="border-border" />

          <section className="text-foreground space-y-4 text-sm leading-relaxed">
            <p>
              클리어 이후에는 텍스트로 결과를 공유할 수 있습니다.
              <br />
              결과 공유에는 소요 시간과 이동 횟수, 그리고 이모지 배열이 포함됩니다.
              <br />
              이모지 배열은 이동 횟수만큼의 정사각형 이모지들과 도착 깃발로 구성되어 있습니다.
              <br />
              정사각형 이모지의 색은 이동한 문서와 도착 문서 사이의 의미적 유사도로 결정됩니다.
            </p>
            <ul className="space-y-1 font-mono text-sm">
              <li>0.2 미만: 🟥</li>
              <li>0.2 이상 0.4 미만: 🟧</li>
              <li>0.4 이상 0.6 미만: 🟨</li>
              <li>0.6 이상 0.8 미만: 🟩</li>
              <li>0.8 이상: 🟦</li>
              <li>뒤로가기를 통한 이동은 ⏪ 이모지로 나타납니다.</li>
            </ul>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
