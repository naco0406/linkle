const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:8787';

export const env = {
  apiBaseUrl: API_BASE_URL.replace(/\/$/u, ''),
  isDev: import.meta.env.DEV,
} as const;
