import type { SupabaseClient, Session } from '@supabase/supabase-js';
import type { Database } from '$lib/schemas/database';

declare global {
  namespace App {
    interface Error {
      message: string;
      errorId?: string;
    }
    interface Locals {
      supabase: SupabaseClient<Database>;
      supabaseAdmin: SupabaseClient<Database>;
      getSession(): Promise<Session | null>;
      moderator: { id: string; email: string; role: 'admin' | 'moderator' } | null;
      ipHashed: string;
      turnstileVerified: boolean;
      insertsPaused: boolean;
    }
    interface PageData {
      // Opcional: solo las páginas que cargan sesión (panel-org, moderar) la
      // proveen vía su +layout.server.ts. Las públicas (mapa, persona) no.
      session?: Session | null;
    }
    interface Platform {
      env: {
        SUPABASE_URL: string;
        SUPABASE_SERVICE_ROLE_KEY: string;
        PUBLIC_SUPABASE_URL: string;
        PUBLIC_SUPABASE_ANON_KEY: string;
        APP_SALT: string;
        TURNSTILE_SECRET_KEY: string;
        PUBLIC_TURNSTILE_SITE_KEY: string;
        RESEND_API_KEY: string;
        RESEND_INBOUND_OPTOUT: string;
        INGEST_USER_AGENT: string;
        ANTHROPIC_API_KEY: string;
        ANTHROPIC_GATEWAY_URL: string;
        LLM_DAILY_BUDGET_USD: string;
        LLM_MODEL_DEFAULT: string;
        LLM_MODEL_COMPLEX: string;
        INSERTS_PAUSED: string;
        FACE_MATCH_ENABLED: string;
        RATE_LIMIT: KVNamespace;
      };
      context: {
        waitUntil(promise: Promise<unknown>): void;
      };
      caches: CacheStorage & { default: Cache };
    }
  }
}

export {};
