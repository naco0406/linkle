/**
 * Post-process a sanitized Wikipedia article by marking anchors whose target
 * the player has already visited this session. We add `data-visited="true"`
 * and let CSS style them — no layout reflow, no DOM mutation after paint.
 *
 * Kept as a pure string → string function so `useMemo` can dedupe work when
 * neither the HTML nor the visited set has changed.
 */

import { parseLinkHref } from '@linkle/shared';

export function annotateVisitedLinks(html: string, visited: Set<string>): string {
  if (visited.size === 0 || html.length === 0) return html;

  const doc = new DOMParser().parseFromString(
    `<!doctype html><html><body><div id="linkle-annotate">${html}</div></body></html>`,
    'text/html',
  );
  const root = doc.getElementById('linkle-annotate');
  if (!root) return html;

  root.querySelectorAll('a[href^="/wiki/"]').forEach((anchor) => {
    const href = anchor.getAttribute('href');
    const raw = parseLinkHref(href);
    if (!raw) return;
    const title = raw.replaceAll('_', ' ');
    if (visited.has(title)) {
      anchor.setAttribute('data-visited', 'true');
    }
  });

  return root.innerHTML;
}
