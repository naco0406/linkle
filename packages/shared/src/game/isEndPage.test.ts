import { describe, expect, it } from 'vitest';
import { formatPageTitle, isEndPage, normalizePageTitle } from './isEndPage.js';

describe('formatPageTitle', () => {
  it('replaces underscores with spaces', () => {
    expect(formatPageTitle('Albert_Einstein')).toBe('Albert Einstein');
  });
  it('leaves already-spaced titles alone', () => {
    expect(formatPageTitle('Albert Einstein')).toBe('Albert Einstein');
  });
});

describe('normalizePageTitle', () => {
  it('lowercases and collapses whitespace', () => {
    expect(normalizePageTitle('  Albert   EINSTEIN  ')).toBe('albert einstein');
  });
});

describe('isEndPage', () => {
  it('matches exact titles', () => {
    expect(isEndPage('세종대왕', '세종대왕')).toBe(true);
  });
  it('trims before comparison', () => {
    expect(isEndPage(' 세종대왕 ', '세종대왕')).toBe(true);
  });
  it('matches case-insensitively via normalization', () => {
    expect(isEndPage('einstein', 'Einstein')).toBe(true);
  });
  it('matches despite collapsed whitespace', () => {
    expect(isEndPage('Alan  Turing', 'Alan Turing')).toBe(true);
  });
  it('matches when disambiguation suffix is the only difference', () => {
    expect(isEndPage('아인슈타인 (물리학자)', '아인슈타인')).toBe(true);
    expect(isEndPage('Einstein', 'Einstein (disambiguation)')).toBe(true);
  });
  it('rejects unrelated titles', () => {
    expect(isEndPage('세종대왕', '이순신')).toBe(false);
  });
  it('rejects empty inputs', () => {
    expect(isEndPage('', 'Einstein')).toBe(false);
    expect(isEndPage('Einstein', '')).toBe(false);
  });
  it('does not match when both titles are only parentheses', () => {
    expect(isEndPage('(hint)', '(other)')).toBe(false);
  });
});
