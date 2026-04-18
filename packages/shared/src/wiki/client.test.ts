import { describe, expect, it } from 'vitest';
import { fetchWikiPage, parseLinkHref, WikiFetchError } from './client.js';

describe('parseLinkHref', () => {
  it('extracts the title from a standard /wiki/ href', () => {
    expect(parseLinkHref('/wiki/Albert_Einstein')).toBe('Albert_Einstein');
  });
  it('decodes URI-encoded titles', () => {
    expect(parseLinkHref('/wiki/%EC%84%B8%EC%A2%85%EB%8C%80%EC%99%95')).toBe('세종대왕');
  });
  it('strips fragment identifiers', () => {
    expect(parseLinkHref('/wiki/Alan_Turing#Early_life')).toBe('Alan_Turing');
  });
  it('returns null for non-/wiki hrefs', () => {
    expect(parseLinkHref('https://example.com')).toBeNull();
    expect(parseLinkHref('#section')).toBeNull();
    expect(parseLinkHref(null)).toBeNull();
    expect(parseLinkHref(undefined)).toBeNull();
  });
  it('rejects namespaced pages', () => {
    expect(parseLinkHref('/wiki/File:Photo.png')).toBeNull();
    expect(parseLinkHref('/wiki/Special:Search')).toBeNull();
  });
});

describe('fetchWikiPage', () => {
  it('parses a valid MediaWiki parse response', async () => {
    const fetcher = (_url: URL): Promise<Response> =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            parse: {
              title: 'Albert Einstein',
              text: { '*': '<p>hi</p>' },
              fullurl: 'https://ko.wikipedia.org/wiki/Albert_Einstein',
            },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      );
    const page = await fetchWikiPage('Albert_Einstein', { fetcher });
    expect(page.title).toBe('Albert Einstein');
    expect(page.html).toBe('<p>hi</p>');
    expect(page.fullUrl).toContain('Albert_Einstein');
  });

  it('throws WikiFetchError on non-2xx', async () => {
    const fetcher = (_url: URL): Promise<Response> =>
      Promise.resolve(new Response('nope', { status: 500 }));
    await expect(fetchWikiPage('X', { fetcher })).rejects.toBeInstanceOf(WikiFetchError);
  });

  it('throws WikiFetchError on shape mismatch', async () => {
    const fetcher = (_url: URL): Promise<Response> =>
      Promise.resolve(
        new Response(JSON.stringify({ hello: 'world' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      );
    await expect(fetchWikiPage('X', { fetcher })).rejects.toBeInstanceOf(WikiFetchError);
  });
});
