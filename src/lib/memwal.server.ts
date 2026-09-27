import { MemWal } from "@mysten-incubation/memwal";

export const DEFAULT_RELAYER_URL = "https://relayer-staging.memory.walrus.xyz";
export const MEMWAL_TIMEOUT_MS = 25000;

export type SecretStatus = {
  MEMWAL_PRIVATE_KEY: boolean;
  MEMWAL_ACCOUNT_ID: boolean;
  MEMWAL_SERVER_URL: boolean;
  GROQ_API_KEY: boolean;
};

export function secretStatus(): SecretStatus {
  return {
    MEMWAL_PRIVATE_KEY: Boolean(process.env["MEMWAL_PRIVATE_KEY"]?.trim()),
    MEMWAL_ACCOUNT_ID: Boolean(process.env["MEMWAL_ACCOUNT_ID"]?.trim()),
    // Optional: falls back to the staging relayer.
    MEMWAL_SERVER_URL: true,
    GROQ_API_KEY: Boolean(process.env["GROQ_API_KEY"]?.trim()),
  };
}

export function missingSecrets(): string[] {
  const status = secretStatus();
  return Object.entries(status)
    .filter(([, present]) => !present)
    .map(([name]) => name);
}

export function namespaceFor(userId: string): string {
  return `dejadev:${userId}`;
}

export function relayerUrl(): string {
  return process.env["MEMWAL_SERVER_URL"]?.trim() ?? DEFAULT_RELAYER_URL;
}

/** Shared MemWal options for both the raw client and the AI SDK middleware. */
export function memwalOptions(userId?: string) {
  // Always trim to avoid whitespace/newline issues in env values.
  const key = process.env["MEMWAL_PRIVATE_KEY"]?.trim();
  const accountId = process.env["MEMWAL_ACCOUNT_ID"]?.trim();
  if (!key || !accountId) return null;
  return {
    key,
    accountId,
    serverUrl: relayerUrl(),
    namespace: userId ? namespaceFor(userId) : "dejadev",
  };
}

/** Returns null when the operator secrets are not configured yet. */
export function getMemWal(userId?: string): MemWal | null {
  const options = memwalOptions(userId);
  if (!options) return null;
  return MemWal.create(options);
}

/**
 * Extracts the x-auth-error header value from a failed response, if the SDK
 * surfaces it on the thrown error object.
 */
function extractAuthErrorHint(error: unknown): string | null {
  if (error == null || typeof error !== "object") return null;
  // Some SDK versions surface the raw response headers on the error.
  const err = error as Record<string, unknown>;
  const headers = err["headers"] ?? err["responseHeaders"];
  if (headers instanceof Headers) {
    return headers.get("x-auth-error") ?? null;
  }
  if (headers && typeof headers === "object") {
    const h = headers as Record<string, unknown>;
    const v = h["x-auth-error"] ?? h["X-Auth-Error"];
    return typeof v === "string" ? v : null;
  }
  return null;
}

/**
 * Produces a human-readable error message from a MemWal SDK error.
 * Distinguishes:
 *  - Clock drift (ERR_TIMESTAMP_OUT_OF_BOUNDS) — fixable by syncing server clock
 *  - 401 registration failure — fixable by the owner in the dashboard
 *  - Other errors
 */
export function describeMemwalError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const authHint = extractAuthErrorHint(error);

  if (authHint === "ERR_TIMESTAMP_OUT_OF_BOUNDS") {
    return (
      "Walrus Memory: server clock out of sync (ERR_TIMESTAMP_OUT_OF_BOUNDS). " +
      "The 5-minute session TTL was exceeded. Sync the server clock (NTP) and retry."
    );
  }

  if (message.includes("401") || message.toLowerCase().includes("unauthorized")) {
    const hint = authHint ? ` (x-auth-error: ${authHint})` : "";
    return (
      `Walrus Memory rejected the delegate key (401)${hint}. ` +
      "Check that MEMWAL_PRIVATE_KEY is the delegate key (not your Sui wallet key) " +
      "registered on MEMWAL_ACCOUNT_ID, and that both belong to the same (staging) environment."
    );
  }
  return message;
}
