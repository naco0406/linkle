import * as React from 'react';
import { Input } from '../Input.js';
import { cn } from '../../lib/cn.js';
import { debounce } from '../../lib/debounce.js';

export interface AutocompleteWikipediaInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  /** DOM id — wired to an external <label htmlFor=...> */
  id?: string;
  className?: string;
  /** Which wiki subdomain to search. Defaults to ko.wikipedia.org. */
  apiHost?: string;
}

interface WikiSuggestion {
  pageid: number;
  title: string;
  description?: string;
  thumbnail?: { source: string };
}

/**
 * Typeahead over Wikipedia articles. Uses the MediaWiki prefixsearch generator
 * so the dropdown surfaces canonical page titles (not arbitrary search hits),
 * which matters for the game: admins must pick an exact title that can be
 * reached via `/wiki/<title>` clicks.
 *
 * Ported from wikirace's src/components/AutocompleteWikipediaInput.tsx with
 * these improvements:
 *   - Debounce is a tiny local helper (no lodash).
 *   - In-flight requests are aborted when the query changes, so stale results
 *     cannot win a race and overwrite the current view.
 *   - Full keyboard navigation (↑/↓/Enter/Escape) with aria-* wiring.
 */
export function AutocompleteWikipediaInput({
  value,
  onChange,
  placeholder = '위키피디아 검색...',
  disabled,
  id,
  className,
  apiHost = 'ko.wikipedia.org',
}: AutocompleteWikipediaInputProps): React.ReactElement {
  const [open, setOpen] = React.useState(false);
  const [highlightedIndex, setHighlightedIndex] = React.useState(-1);
  const [suggestions, setSuggestions] = React.useState<WikiSuggestion[]>([]);
  const [loading, setLoading] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const listboxId = React.useId();

  // Keep one abort controller per fetch so only the newest request wins.
  const inFlightRef = React.useRef<AbortController | null>(null);
  const fetchSuggestions = React.useCallback(
    async (query: string): Promise<void> => {
      if (!query.trim()) {
        setSuggestions([]);
        setLoading(false);
        return;
      }
      inFlightRef.current?.abort();
      const controller = new AbortController();
      inFlightRef.current = controller;
      setLoading(true);
      try {
        const url =
          `https://${apiHost}/w/api.php?` +
          'action=query&format=json&generator=prefixsearch' +
          '&prop=pageprops%7Cpageimages%7Cdescription' +
          '&redirects=&ppprop=displaytitle&piprop=thumbnail&pithumbsize=120' +
          '&pilimit=6&gpsnamespace=0&gpslimit=6&origin=*' +
          `&gpssearch=${encodeURIComponent(query)}`;
        const res = await fetch(url, { signal: controller.signal });
        const raw: unknown = await res.json();
        if (controller.signal.aborted) return;
        const pages = extractPages(raw);
        setSuggestions(pages);
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setSuggestions([]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    },
    [apiHost],
  );

  const debouncedFetch = React.useMemo(
    () => debounce((q: string) => void fetchSuggestions(q), 300),
    [fetchSuggestions],
  );
  React.useEffect(
    () => () => {
      debouncedFetch.cancel();
    },
    [debouncedFetch],
  );

  // Close when the user clicks or touches anywhere outside.
  React.useEffect(() => {
    const handler = (e: MouseEvent): void => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
    };
  }, []);

  const commit = (s: WikiSuggestion): void => {
    onChange(s.title);
    setOpen(false);
    setHighlightedIndex(-1);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const next = e.currentTarget.value;
    onChange(next);
    setOpen(true);
    setHighlightedIndex(-1);
    debouncedFetch(next);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (!open || suggestions.length === 0) {
      if (e.key === 'ArrowDown' && suggestions.length > 0) {
        setOpen(true);
        setHighlightedIndex(0);
        e.preventDefault();
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      setHighlightedIndex((i) => (i + 1) % suggestions.length);
      e.preventDefault();
    } else if (e.key === 'ArrowUp') {
      setHighlightedIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
      e.preventDefault();
    } else if (e.key === 'Enter') {
      const pick = suggestions[highlightedIndex] ?? suggestions[0];
      if (pick) {
        commit(pick);
        e.preventDefault();
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
      e.preventDefault();
    }
  };

  const showList = open && suggestions.length > 0;

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <Input
        id={id}
        type="text"
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        onChange={handleChange}
        onFocus={() => {
          setOpen(true);
          if (value.trim() && suggestions.length === 0) debouncedFetch(value);
        }}
        onKeyDown={handleKeyDown}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={showList}
        aria-controls={listboxId}
        aria-busy={loading}
        autoComplete="off"
        spellCheck={false}
      />
      {showList ? (
        <ul
          id={listboxId}
          role="listbox"
          className={cn(
            'absolute left-0 top-full z-20 mt-2 max-h-60 w-full overflow-auto',
            'border-border bg-card shadow-elevated rounded-lg border',
          )}
        >
          {suggestions.map((s, idx) => {
            const active = idx === highlightedIndex;
            return (
              <li
                key={s.pageid}
                role="option"
                aria-selected={active}
                onMouseDown={(e) => {
                  // mousedown fires before the input blurs; prevent blur race
                  e.preventDefault();
                  commit(s);
                }}
                onMouseEnter={() => {
                  setHighlightedIndex(idx);
                }}
                className={cn(
                  'flex cursor-pointer items-center gap-2 p-2',
                  active ? 'bg-accent text-accent-foreground' : 'hover:bg-muted',
                )}
              >
                {s.thumbnail ? (
                  <img
                    src={s.thumbnail.source}
                    alt=""
                    loading="lazy"
                    className="size-8 shrink-0 rounded object-cover"
                  />
                ) : (
                  <span aria-hidden className="bg-muted size-8 shrink-0 rounded" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-foreground truncate font-medium">{s.title}</div>
                  {s.description ? (
                    <div className="text-muted-foreground truncate text-sm">{s.description}</div>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

/** Safely pluck the `query.pages` object from the MediaWiki response shape. */
function extractPages(raw: unknown): WikiSuggestion[] {
  if (typeof raw !== 'object' || raw === null) return [];
  const query = (raw as { query?: unknown }).query;
  if (typeof query !== 'object' || query === null) return [];
  const pages = (query as { pages?: unknown }).pages;
  if (typeof pages !== 'object' || pages === null) return [];
  const list: WikiSuggestion[] = [];
  for (const entry of Object.values(pages as Record<string, unknown>)) {
    if (typeof entry !== 'object' || entry === null) continue;
    const p = entry as Record<string, unknown>;
    const pageid = typeof p.pageid === 'number' ? p.pageid : null;
    const title = typeof p.title === 'string' ? p.title : null;
    if (pageid === null || title === null) continue;
    const description = typeof p.description === 'string' ? p.description : undefined;
    const thumbRaw = p.thumbnail;
    const thumbnail =
      typeof thumbRaw === 'object' &&
      thumbRaw !== null &&
      typeof (thumbRaw as { source?: unknown }).source === 'string'
        ? { source: (thumbRaw as { source: string }).source }
        : undefined;
    const item: WikiSuggestion = { pageid, title };
    if (description !== undefined) item.description = description;
    if (thumbnail !== undefined) item.thumbnail = thumbnail;
    list.push(item);
  }
  return list;
}
