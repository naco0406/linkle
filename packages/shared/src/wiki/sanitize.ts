/**
 * Wikipedia HTML sanitizer.
 *
 * Replaces the regex-based pipeline in the original wikirace. The policy is
 * *declarative* and driven by DOMParser so that markup variance from the
 * minerva skin does not silently break the game board.
 *
 * Guarantees after sanitizing:
 *   - No navigation chrome or references (policy-removed selectors).
 *   - No sections titled "같이 보기", "각주", "외부 링크".
 *   - Links are either `/wiki/<Title>` internal links or neutralized `<span>`s.
 *   - No `<script>` / `<audio>` / `<style>` / inline event handlers.
 */

export interface SanitizePolicy {
  /** h2 section titles to drop entirely (inclusive of all content below until
   *  the next same-or-higher-level heading). Matched case-insensitively. */
  readonly removeSections: readonly string[];
  /** CSS selectors removed before link rewriting. */
  readonly removeBySelector: readonly string[];
  /** Predicate — returning true keeps the <a>; false turns it into a <span>. */
  readonly linkAllow: (href: string) => boolean;
}

export const SANITIZE_POLICY: SanitizePolicy = {
  removeSections: ['같이 보기', '각주', '외부 링크'],
  removeBySelector: [
    '#mw-navigation',
    '#footer',
    '#siteNotice',
    '.mw-references-wrap',
    '.mw-editsection',
    '.dablink',
    '.hatnote',
    '.navbox',
    '.metadata.mbox-small',
    'audio',
    'script',
    'style',
    'noscript',
    'link',
    'meta',
  ],
  linkAllow: (href) => href.startsWith('/wiki/') && !/\/wiki\/[^/]+:/u.test(href),
};

const HEADING_LEVELS = ['H1', 'H2', 'H3', 'H4', 'H5', 'H6'] as const;

function isHeading(el: Element | null): el is Element {
  return !!el && (HEADING_LEVELS as readonly string[]).includes(el.tagName);
}

function headingLevel(el: Element): number {
  const idx = HEADING_LEVELS.indexOf(el.tagName as (typeof HEADING_LEVELS)[number]);
  return idx + 1; // 1..6
}

function matchesSectionTitle(el: Element, titles: readonly string[]): boolean {
  const text = el.textContent.trim().toLowerCase();
  if (!text) return false;
  return titles.some((t) => text.includes(t.toLowerCase()));
}

/**
 * Collapse and remove a heading plus all nodes beneath it until a heading of
 * the same or higher level is encountered.
 */
function removeSectionStartingAt(heading: Element): void {
  const level = headingLevel(heading);
  let cursor: Element | null = heading.nextElementSibling;
  const doomed: Element[] = [heading];
  while (cursor) {
    if (isHeading(cursor) && headingLevel(cursor) <= level) break;
    doomed.push(cursor);
    cursor = cursor.nextElementSibling;
  }
  for (const el of doomed) el.remove();
}

function dropInlineAttributes(el: Element): void {
  const names = Array.from(
    { length: el.attributes.length },
    (_, i) => el.attributes[i]?.name ?? '',
  );
  for (const name of names) {
    if (name.startsWith('on')) {
      el.removeAttribute(name);
    }
  }
}

function neutralizeLinks(root: ParentNode, policy: SanitizePolicy): void {
  const anchors = root.querySelectorAll('a');
  anchors.forEach((anchor) => {
    dropInlineAttributes(anchor);
    const href = anchor.getAttribute('href');
    if (!href || !policy.linkAllow(href)) {
      const doc = anchor.ownerDocument;
      const replacement = doc.createElement('span');
      replacement.textContent = anchor.textContent;
      if (anchor.className) replacement.className = anchor.className;
      anchor.replaceWith(replacement);
      return;
    }
    // Drop anything that could pop the user out of the SPA.
    anchor.removeAttribute('target');
    anchor.removeAttribute('rel');
    anchor.removeAttribute('title');
  });
}

/**
 * Main entry point. Takes raw HTML (from Wikipedia's parse API) and returns
 * a sanitized string suitable for `dangerouslySetInnerHTML`.
 */
export function sanitizeWikipediaHtml(
  rawHtml: string,
  policy: SanitizePolicy = SANITIZE_POLICY,
  domParser: DOMParser = new DOMParser(),
): string {
  const doc = domParser.parseFromString(
    `<!doctype html><html><body><div id="linkle-root">${rawHtml}</div></body></html>`,
    'text/html',
  );
  const root = doc.getElementById('linkle-root');
  if (!root) return '';

  // 1. Drop chrome/misc by selector.
  for (const selector of policy.removeBySelector) {
    root.querySelectorAll(selector).forEach((el) => {
      el.remove();
    });
  }

  // 2. Drop named sections (iterate headings; match; remove including content).
  //    Re-query each pass because removing a heading rebalances siblings.
  let guard = 0;
  while (guard < 40) {
    const headings = root.querySelectorAll(HEADING_LEVELS.join(','));
    const doomed = Array.from(headings).find((h) => matchesSectionTitle(h, policy.removeSections));
    if (!doomed) break;
    removeSectionStartingAt(doomed);
    guard += 1;
  }

  // 3. Neutralize or strip anchors based on linkAllow policy.
  neutralizeLinks(root, policy);

  // 4. Remove inline event handlers everywhere.
  root.querySelectorAll('*').forEach(dropInlineAttributes);

  return root.innerHTML;
}
