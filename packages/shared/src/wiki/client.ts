import { formatPageTitle } from '../game/isEndPage.js';

export interface WikiPage {
  readonly title: string;
  readonly html: string;
  readonly fullUrl: string;
}

/**
 * Low-level fetch function. Exported so the web app can inject a retrying /
 * caching wrapper, and tests can inject `page.route`-style fakes.
 */
export type WikiFetcher = (input: URL) => Promise<Response>;

const DEFAULT_API = 'https://ko.wikipedia.org/w/api.php';

/**
 * Call the MediaWiki parse API and return a minimal {@link WikiPage}. The
 * sanitization step is explicitly *not* performed here — callers are expected
 * to pipe the `html` through `sanitizeWikipediaHtml` before rendering.
 */
export async function fetchWikiPage(
  title: string,
  options: {
    readonly fetcher?: WikiFetcher;
    readonly apiBase?: string;
    readonly signal?: AbortSignal;
  } = {},
): Promise<WikiPage> {
  const { fetcher, apiBase = DEFAULT_API, signal } = options;
  const url = new URL(apiBase);
  url.search = new URLSearchParams({
    action: 'parse',
    format: 'json',
    page: title,
    prop: 'text|displaytitle|sections|revid',
    disableeditsection: '1',
    disabletoc: '1',
    mobileformat: '1',
    sectionpreview: '0',
    redirects: '1',
    useskin: 'minerva',
    origin: '*',
  }).toString();

  const runFetcher = fetcher ?? ((u: URL) => (signal ? fetch(u, { signal }) : fetch(u)));
  const response = await runFetcher(url);

  if (!response.ok) {
    throw new WikiFetchError(`Wikipedia responded ${String(response.status)}`, {
      status: response.status,
    });
  }

  const json: unknown = await response.json();
  const parse = extractParse(json);
  if (!parse) {
    throw new WikiFetchError('Invalid Wikipedia response shape');
  }

  return {
    title: formatPageTitle(parse.title),
    html: parse.text,
    fullUrl: parse.fullUrl,
  };
}

function extractParse(json: unknown): { title: string; text: string; fullUrl: string } | null {
  if (typeof json !== 'object' || json === null) return null;
  const parse = (json as { parse?: unknown }).parse;
  if (typeof parse !== 'object' || parse === null) return null;
  const p = parse as Record<string, unknown>;
  const title = typeof p.title === 'string' ? p.title : null;
  const textField = p.text;
  const text =
    typeof textField === 'object' && textField !== null
      ? ((textField as Record<string, unknown>)['*'] ?? null)
      : null;
  const fullUrl = typeof p.fullurl === 'string' ? p.fullurl : '';
  if (!title || typeof text !== 'string') return null;
  return { title, text, fullUrl };
}

/**
 * Given an `<a>` href from a sanitized article, return the target page title
 * (unformatted — call `formatPageTitle` on the result for display).
 *
 * Returns null for hrefs that are not internal wiki articles (the sanitizer
 * should have stripped these already; this is belt-and-suspenders).
 */
export function parseLinkHref(href: string | null | undefined): string | null {
  if (!href?.startsWith('/wiki/')) return null;
  const raw = href.slice('/wiki/'.length);
  if (!raw || raw.includes(':')) return null;
  try {
    return decodeURIComponent(raw.split('#')[0] ?? raw);
  } catch {
    return null;
  }
}

export class WikiFetchError extends Error {
  readonly status?: number;
  constructor(message: string, options: { status?: number } = {}) {
    super(message);
    this.name = 'WikiFetchError';
    if (options.status !== undefined) this.status = options.status;
  }
}
