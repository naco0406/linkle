/**
 * Wikipedia page title helpers. All of these are pure — they do not hit the
 * network and do not depend on any DOM. Covered by `isEndPage.test.ts`.
 */

/** Replace `_` with space. Wikipedia URL slugs use underscores. */
export function formatPageTitle(title: string): string {
  return title.replaceAll('_', ' ');
}

/**
 * Lowercase + collapse internal whitespace. Trim.
 * Used only for comparison, never for display.
 */
export function normalizePageTitle(title: string): string {
  return title.toLowerCase().replace(/\s+/gu, ' ').trim();
}

/** Strip one or more trailing disambiguation parentheses: "X (Y)" → "X". */
function stripParens(title: string): string {
  return title.replace(/\s*\([^()]*\)\s*$/gu, '').trim();
}

/**
 * Three-tiered fuzzy match between the page the player is on and the goal.
 * In decreasing confidence:
 *   1. Exact trim match.
 *   2. Normalized (lowercase + whitespace) match.
 *   3. Match after stripping trailing "(…)" disambiguation suffix.
 *
 * This is the *client-side* check. The server performs the same check on
 * submission so a tampered client cannot claim victory incorrectly.
 */
export function isEndPage(currentTitle: string, endTitle: string): boolean {
  if (!currentTitle || !endTitle) return false;

  const currentTrim = currentTitle.trim();
  const endTrim = endTitle.trim();
  if (currentTrim === endTrim) return true;

  const currentNorm = normalizePageTitle(currentTrim);
  const endNorm = normalizePageTitle(endTrim);
  if (currentNorm === endNorm) return true;

  const currentBare = normalizePageTitle(stripParens(currentTrim));
  const endBare = normalizePageTitle(stripParens(endTrim));
  return currentBare !== '' && currentBare === endBare;
}
