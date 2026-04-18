import { describe, expect, it } from 'vitest';
import { validatePath } from './validatePath.js';
import type { Path, PathEntry } from '../types/index.js';

const back: PathEntry = { type: 'back' };
const page = (title: string): PathEntry => ({ type: 'page', title });
const trail = (...steps: PathEntry[]): Path => steps;

describe('validatePath', () => {
  it('accepts a straight path that starts and ends correctly', () => {
    const issues = validatePath(
      trail(page('대한민국'), page('문화'), page('음악'), page('비틀즈')),
      '대한민국',
      '비틀즈',
    );
    expect(issues).toEqual([]);
  });

  it('rejects an empty path', () => {
    expect(validatePath([], 'A', 'B')).toEqual([expect.objectContaining({ kind: 'empty-path' })]);
  });

  it('flags wrong start page', () => {
    const issues = validatePath(
      trail(page('중국'), page('문화'), page('비틀즈')),
      '대한민국',
      '비틀즈',
    );
    expect(issues.some((i) => i.kind === 'not-started-at-start')).toBe(true);
  });

  it('flags wrong end page', () => {
    const issues = validatePath(
      trail(page('대한민국'), page('문화'), page('음악')),
      '대한민국',
      '비틀즈',
    );
    expect(issues.some((i) => i.kind === 'not-ended-at-end')).toBe(true);
  });

  it('flags back without enough history', () => {
    const issues = validatePath(
      trail(page('대한민국'), back, page('비틀즈')),
      '대한민국',
      '비틀즈',
    );
    expect(issues.some((i) => i.kind === 'consecutive-back-without-history')).toBe(true);
  });

  it('accepts back when there is enough history', () => {
    const issues = validatePath(
      trail(page('대한민국'), page('문화'), back, page('비틀즈')),
      '대한민국',
      '비틀즈',
    );
    expect(issues).toEqual([]);
  });
});
