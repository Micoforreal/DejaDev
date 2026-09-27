import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/memories")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { getAuthUser } = await import("@/lib/auth.server");
        const auth = await getAuthUser(request);
        if (!auth.ok) {
          return Response.json({ error: auth.error }, { status: auth.status });
        }
        const { userId, isDemo } = auth;

        const { getDb } = await import("@/lib/db.server");
        const db = await getDb();

        // Demo users use the legacy text user_id column.
        // Real users use the auth_user_id uuid column.
        const [memories, insights, messages] = await Promise.all([
          isDemo
            ? db
                .from("memories")
                .select("id, text, source, status, blob_id, superseded_by, created_at")
                .eq("user_id", userId)
                .order("created_at", { ascending: false })
                .limit(200)
            : db
                .from("memories")
                .select("id, text, source, status, blob_id, superseded_by, created_at")
                .eq("auth_user_id", userId)
                .order("created_at", { ascending: false })
                .limit(200),
          isDemo
            ? db
                .from("insights")
                .select("cards, summary, created_at")
                .eq("user_id", userId)
                .order("created_at", { ascending: false })
                .limit(1)
                .maybeSingle()
            : db
                .from("insights")
                .select("cards, summary, created_at")
                .eq("auth_user_id", userId)
                .order("created_at", { ascending: false })
                .limit(1)
                .maybeSingle(),
          isDemo
            ? db
                .from("chat_messages")
                .select("id, role, content, recalled, created_at")
                .eq("user_id", userId)
                .order("created_at", { ascending: true })
                .limit(60)
            : db
                .from("chat_messages")
                .select("id, role, content, recalled, created_at")
                .eq("auth_user_id", userId)
                .order("created_at", { ascending: true })
                .limit(60),
        ]);

        if (memories.error) return Response.json({ error: memories.error.message }, { status: 500 });

        return Response.json({
          memories: memories.data ?? [],
          insights: insights.data ?? null,
          messages: messages.data ?? [],
          isDemo,
        });
      },
    },
  },
});
