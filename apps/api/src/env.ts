/**
 * Worker environment bindings. Keep all string coercion in one file so the
 * rest of the Worker can consume a typed Env.
 */
export interface Env {
  readonly DB: D1Database;
  readonly ALLOWED_ORIGINS: string;
  readonly OPENAI_MODEL: string;
  readonly OPENAI_API_KEY?: string;
  /**
   * Override where the OpenAI client POSTs. Useful for routing through
   * Cloudflare AI Gateway so calls originate from an OpenAI-allowed region
   * (workers.dev IPs can be blocked with 403 `unsupported_country_region_territory`).
   * Expected format: the base URL up to and including "…/openai", e.g.
   *   https://gateway.ai.cloudflare.com/v1/<account>/<gateway>/openai
   * The client appends `/chat/completions`. Defaults to the official API.
   */
  readonly OPENAI_BASE_URL?: string;
  readonly ADMIN_JWT_SECRET?: string;
}

export function allowedOrigins(env: Env): string[] {
  return env.ALLOWED_ORIGINS.split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}
