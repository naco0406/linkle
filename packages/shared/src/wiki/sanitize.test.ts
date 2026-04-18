// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { sanitizeWikipediaHtml } from './sanitize.js';

function norm(s: string): string {
  return s.replace(/\s+/gu, ' ').trim();
}

describe('sanitizeWikipediaHtml', () => {
  it('returns empty string for empty input', () => {
    expect(sanitizeWikipediaHtml('')).toBe('');
  });

  it('strips navigation chrome by selector', () => {
    const html = `
      <div id="mw-navigation">nav</div>
      <div id="footer">footer</div>
      <div class="navbox">big table</div>
      <div id="content"><p>본문 내용</p></div>
    `;
    const out = sanitizeWikipediaHtml(html);
    expect(out).not.toContain('mw-navigation');
    expect(out).not.toContain('footer');
    expect(out).not.toContain('navbox');
    expect(norm(out)).toContain('본문 내용');
  });

  it('drops scripts and audio tags', () => {
    const html = `
      <p>음악</p>
      <audio controls><source src="x.ogg"></audio>
      <script>alert(1)</script>
    `;
    const out = sanitizeWikipediaHtml(html);
    expect(out).not.toContain('<audio');
    expect(out).not.toContain('<script');
  });

  it('removes "같이 보기" section along with its content', () => {
    const html = `
      <p>도입부</p>
      <h2>개요</h2><p>개요 내용</p>
      <h2>같이 보기</h2>
      <ul><li><a href="/wiki/Other">다른 글</a></li></ul>
      <h2>각주</h2><ol><li>ref</li></ol>
    `;
    const out = sanitizeWikipediaHtml(html);
    expect(out).toContain('개요 내용');
    expect(out).not.toContain('같이 보기');
    expect(out).not.toContain('각주');
    expect(out).not.toContain('다른 글');
  });

  it('keeps internal /wiki/ anchors but strips unsafe attributes', () => {
    const html = `<p><a href="/wiki/Alan_Turing" target="_blank" onclick="x()" rel="external">앨런</a></p>`;
    const out = sanitizeWikipediaHtml(html);
    expect(out).toContain('href="/wiki/Alan_Turing"');
    expect(out).not.toContain('target=');
    expect(out).not.toContain('onclick');
    expect(out).not.toContain('rel=');
  });

  it('replaces external links with spans', () => {
    const html = `<p><a href="https://example.com">외부</a> and <a href="/wiki/Einstein">내부</a></p>`;
    const out = sanitizeWikipediaHtml(html);
    expect(out).not.toContain('href="https://example.com"');
    expect(out).toContain('<span');
    expect(out).toContain('>외부</span>');
    expect(out).toContain('href="/wiki/Einstein"');
  });

  it('replaces namespaced wiki links (e.g. File:, Special:) with spans', () => {
    const html = `<a href="/wiki/File:Photo.png">photo</a><a href="/wiki/Special:Search">search</a>`;
    const out = sanitizeWikipediaHtml(html);
    expect(out).not.toContain('href="/wiki/File:Photo.png"');
    expect(out).not.toContain('href="/wiki/Special:Search"');
  });

  it('removes hatnote and dablink', () => {
    const html = `<div class="hatnote">hat</div><div class="dablink">dab</div><p>본문</p>`;
    const out = sanitizeWikipediaHtml(html);
    expect(out).not.toContain('hat');
    expect(out).not.toContain('dab');
    expect(out).toContain('본문');
  });
});
