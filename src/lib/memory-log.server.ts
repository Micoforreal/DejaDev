import type { MemWal } from "@mysten-incubation/memwal";
import { getDb } from "./db.server";
import { isDemoUser } from "./db.server";
import { MEMWAL_TIMEOUT_MS, namespaceFor } from "./memwal.server";

export type RecalledMemory = { text: string; blobId: string; distance: number; memoryId?: string };

/**
 * Recall has no default relevance threshold — always pass maxDistance and
 * filter again client-side. Distance guide: <0.25 duplicate, 0.25-0.55 related,
 * 0.55-0.8 weak, >=0.8 unrelated (dropped).
 */
export async function recallForUser(
  memwal: MemWal,
  userId: string,
  query: string,
  limit = 5,
): Promise<RecalledMemory[]> {
  const result = await memwal.recall({
    query,
    limit,
    namespace: namespaceFor(userId),
    maxDistance: 0.8,
  });
  return (result.results ?? [])
    .filter((hit) => hit.distance < 0.8)
    .map((hit) => ({ text: hit.text, blobId: hit.blob_id, distance: hit.distance }));
}

export type LoggedMemory = {
  id: string;
  text: string;
  status: string;
  created_at: string;
  source: string;
  blob_id: string | null;
  superseded_by: string | null;
};

/** Every write to Walrus is mirrored into the app DB so the timeline has timestamps. */
export async function logMemory(params: {
  userId: string;
  text: string;
  source: string;
  status: "indexed" | "indexing" | "failed";
  memoryId?: string | null;
  blobId?: string | null;
  jobId?: string | null;
}): Promise<LoggedMemory | null> {
  const db = await getDb();
  const isDemo = isDemoUser(params.userId);

  // Demo users: use text user_id (FK to profiles). Real users: auth_user_id uuid.
  const insertPayload = isDemo
    ? {
        user_id: params.userId,
        namespace: namespaceFor(params.userId),
        text: params.text,
        source: params.source,
        status: params.status,
        memory_id: params.memoryId ?? null,
        blob_id: params.blobId ?? null,
        job_id: params.jobId ?? null,
      }
    : {
        auth_user_id: params.userId,
        // user_id is required (NOT NULL FK to profiles) so we need a placeholder.
        // For real auth users we use their auth uuid as user_id too, after ensuring
        // they have a profiles row (created at sign-up). This keeps the FK intact.
        user_id: params.userId,
        namespace: namespaceFor(params.userId),
        text: params.text,
        source: params.source,
        status: params.status,
        memory_id: params.memoryId ?? null,
        blob_id: params.blobId ?? null,
        job_id: params.jobId ?? null,
      };

  const { data, error } = await db
    .from("memories")
    .insert(insertPayload)
    .select("id, text, status, created_at, source, blob_id, superseded_by")
    .single();
  if (error) {
    console.error("logMemory failed", error);
    return null;
  }
  return data as LoggedMemory;
}

/**
 * remember() is append-only, so staleness is handled app-side: when a new fact
 * near-duplicates an older one, the older timeline entry is marked superseded.
 */
export async function supersedeContradicted(params: {
  memwal: MemWal;
  userId: string;
  newRowId: string;
  factText: string;
}): Promise<string[]> {
  const db = await getDb();
  const isDemo = isDemoUser(params.userId);
  let hits: RecalledMemory[] = [];
  try {
    hits = await recallForUser(params.memwal, params.userId, params.factText, 4);
  } catch {
    return [];
  }
  const stale = hits.filter((hit) => hit.distance < 0.25).map((hit) => hit.text);
  if (stale.length === 0) return [];

  const baseQuery = db
    .from("memories")
    .update({ superseded_by: params.newRowId })
    .is("superseded_by", null)
    .neq("id", params.newRowId)
    .in("text", stale);

  const { data, error } = isDemo
    ? await baseQuery.eq("user_id", params.userId).select("id")
    : await baseQuery.eq("auth_user_id", params.userId).select("id");

  if (error) {
    console.error("supersede failed", error);
    return [];
  }
  return (data ?? []).map((row: { id: string }) => row.id);
}

/**
 * Store a check-in / conversation turn as discrete facts, waiting for indexing
 * so the timeline can show them immediately. Falls back to an "indexing…" entry
 * when the relayer takes longer than the timeout.
 */
export async function analyzeAndLog(params: {
  memwal: MemWal;
  userId: string;
  text: string;
  source: string;
}): Promise<{ memories: LoggedMemory[]; superseded: string[]; error?: string }> {
  const namespace = namespaceFor(params.userId);
  const memories: LoggedMemory[] = [];
  const superseded: string[] = [];
  try {
    const result = await params.memwal.analyzeAndWait(
      params.text,
      { namespace },
      { timeoutMs: MEMWAL_TIMEOUT_MS },
    );
    for (const fact of result.facts ?? []) {
      const row = await logMemory({
        userId: params.userId,
        text: fact.text,
        source: params.source,
        status: fact.blob_id ? "indexed" : "indexing",
        memoryId: fact.id,
        blobId: fact.blob_id ?? null,
        jobId: fact.job_id ?? null,
      });
      if (!row) continue;
      memories.push(row);
      const marked = await supersedeContradicted({
        memwal: params.memwal,
        userId: params.userId,
        newRowId: row.id,
        factText: fact.text,
      });
      superseded.push(...marked);
    }
    return { memories, superseded };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // Timeout / transient relayer issue: keep the fact visible as "indexing…".
    const row = await logMemory({
      userId: params.userId,
      text: params.text,
      source: params.source,
      status: "indexing",
    });
    if (row) memories.push(row);
    return { memories, superseded, error: message };
  }
}
