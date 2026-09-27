/**
 * Server-only auth helper for API route handlers.
 * Verifies the Supabase session Bearer token and returns the userId.
 * For demo mode, the client sends X-Demo-User-Id and this function
 * checks it against the allow-list of demo user IDs.
 */

import { isDemoUser } from "./db.server";

export type AuthResult =
  | { ok: true; userId: string; isDemo: boolean }
  | { ok: false; status: number; error: string };

/**
 * Extracts and verifies the caller's identity from the request.
 *
 * Authentication priority:
 *  1. Authorization: Bearer <jwt>  → verified via supabase.auth.getUser()
 *  2. X-Demo-User-Id header        → only for allow-listed demo user IDs
 *
 * Returns a 401 response descriptor for any unauthenticated call.
 */
export async function getAuthUser(request: Request): Promise<AuthResult> {
  const authHeader = request.headers.get("authorization") ?? "";
  const demoHeader = request.headers.get("x-demo-user-id") ?? "";

  // ── Real user path ─────────────────────────────────────────────────────────
  if (authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    const SUPABASE_URL = process.env["SUPABASE_URL"]?.trim();
    const SUPABASE_PUBLISHABLE_KEY = process.env["SUPABASE_PUBLISHABLE_KEY"]?.trim();

    if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
      return { ok: false, status: 503, error: "Supabase is not configured on the server." };
    }

    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user?.id) {
      return { ok: false, status: 401, error: "Unauthorized: invalid or expired session." };
    }
    return { ok: true, userId: data.user.id, isDemo: false };
  }

  // ── Demo mode path ──────────────────────────────────────────────────────────
  if (demoHeader && isDemoUser(demoHeader)) {
    return { ok: true, userId: demoHeader, isDemo: true };
  }

  // ── No credentials ──────────────────────────────────────────────────────────
  if (demoHeader && !isDemoUser(demoHeader)) {
    return { ok: false, status: 401, error: "Unauthorized: unknown demo user." };
  }

  return { ok: false, status: 401, error: "Unauthorized: no session token provided." };
}
