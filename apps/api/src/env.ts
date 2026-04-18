/**
 * Worker environment bindings. Keep all string coercion in one file so the
 * rest of the Worker can consume a typed Env.
 */
export interface Env {
  readonly DB: D1Database;
  readonly ALLOWED_ORIGINS: string;
  readonly OPENAI_MODEL: string;
  readonly OPENAI_API_KEY?: string;
  readonly ADMIN_JWT_SECRET?: string;
}

export function allowedOrigins(env: Env): string[] {
  return env.ALLOWED_ORIGINS.split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}
