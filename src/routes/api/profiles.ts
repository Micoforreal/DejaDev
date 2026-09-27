import { createFileRoute } from "@tanstack/react-router";

/**
 * GET /api/profiles — returns only the seeded demo profiles.
 * Real user profiles are fetched via /api/memories (after auth).
 */
export const Route = createFileRoute("/api/profiles")({
  server: {
    handlers: {
      GET: async () => {
        const { getDb, DEMO_USER_IDS } = await import("@/lib/db.server");
        const db = await getDb();
        const { data, error } = await db
          .from("profiles")
          .select("id, name, handle, accent")
          .in("id", [...DEMO_USER_IDS])
          .order("created_at", { ascending: true });
        if (error) return Response.json({ error: error.message }, { status: 500 });
        return Response.json({ profiles: data ?? [] });
      },
    },
  },
});
