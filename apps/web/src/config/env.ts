// Consolidated, typed access to Vite env variables. Accessed only here so
// the rest of the app doesn't reach into `import.meta.env`.

const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:8787';

export const env = {
  apiBaseUrl: API_BASE_URL.replace(/\/$/u, ''),
  isDev: import.meta.env.DEV,
} as const;
