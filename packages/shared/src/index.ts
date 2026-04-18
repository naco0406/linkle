// Node/Worker/Browser-safe barrel. Contains pure domain code: types,
// game logic, emoji rendering, KST time helpers, and the Wikipedia client.
// Browser-only code (HTML sanitizer) is reached via `@linkle/shared/sanitize`.

export * from './types/index.js';
export * from './game/index.js';
export * from './wiki/client.js';
export * from './emoji/index.js';
export * from './time/index.js';
