/**
 * Tipos del núcleo JS compartido scripts/ingest/venezuela-te-busca-core.mjs
 * (lo reusamos en el Worker; esbuild lo empaqueta, esto solo satisface a TS).
 */
declare module '*/venezuela-te-busca-core.mjs' {
  export const SOURCE: string;
  export const SOURCE_URL: string;
  export const UA: string;
  export const THROTTLE_MS: number;
  export const PAGE_SIZE: number;
  export const sleep: (ms: number) => Promise<void>;
  export function fetchPageValid(
    page: number,
    opts?: { fetchImpl?: typeof fetch; tries?: number }
  ): Promise<{
    persons: Array<Record<string, unknown>>;
    hasMore: boolean;
    totalCount?: number;
    stats?: unknown;
    echoPage?: number;
  }>;
  export function mapRecord(p: Record<string, unknown>): null | {
    source: string;
    source_id: string;
    source_url: string;
    given_name: string | null;
    family_name: string | null;
    age: number | null;
    sex: string;
    status: string;
    last_known_location_text: string;
    description: string | null;
    photo_url: string | null;
    lat: number;
    lng: number;
  };
}
