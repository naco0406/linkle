import type { Path } from '../types/index.js';
import { isEndPage } from './isEndPage.js';

export interface PathValidationIssue {
  readonly kind:
    | 'empty-path'
    | 'not-started-at-start'
    | 'not-ended-at-end'
    | 'exceeds-max-length'
    | 'consecutive-back-without-history';
  readonly message: string;
  readonly index?: number;
}

const MAX_PATH_LENGTH = 500;

/**
 * Cheap client-side validation of a submitted path. This does NOT verify that
 * each link was actually present on the source Wikipedia page — that would
 * require re-fetching Wikipedia and is a server concern (and arguably a v1.1
 * feature). For now we check structural invariants only.
 */
export function validatePath(
  path: Path,
  startPage: string,
  endPage: string,
): PathValidationIssue[] {
  const issues: PathValidationIssue[] = [];

  if (path.length === 0) {
    issues.push({ kind: 'empty-path', message: '경로가 비어있습니다.' });
    return issues;
  }

  if (path.length > MAX_PATH_LENGTH) {
    issues.push({
      kind: 'exceeds-max-length',
      message: `경로가 너무 깁니다. (최대 ${String(MAX_PATH_LENGTH)}단계)`,
    });
  }

  const first = path[0];
  if (first?.type !== 'page' || !isEndPage(first.title, startPage)) {
    issues.push({
      kind: 'not-started-at-start',
      message: `경로는 시작 페이지(${startPage})에서 출발해야 합니다.`,
      index: 0,
    });
  }

  const last = path[path.length - 1];
  if (last?.type !== 'page' || !isEndPage(last.title, endPage)) {
    issues.push({
      kind: 'not-ended-at-end',
      message: `경로는 도착 페이지(${endPage})에서 끝나야 합니다.`,
      index: path.length - 1,
    });
  }

  // If the first entry is a "back", there's no history to go back to.
  let visitedPageCount = 0;
  path.forEach((entry, index) => {
    if (entry.type === 'page') {
      visitedPageCount += 1;
      return;
    }
    if (visitedPageCount < 2) {
      issues.push({
        kind: 'consecutive-back-without-history',
        message: '돌아갈 이전 페이지가 없는 상태에서 뒤로가기를 사용할 수 없습니다.',
        index,
      });
    } else {
      // Back consumes one visited step.
      visitedPageCount -= 1;
    }
  });

  return issues;
}
