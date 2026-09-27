import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/checkin")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { getAuthUser } = await import("@/lib/auth.server");
        const { rateLimit } = await import("@/lib/rate-limit.server");

        const auth = await getAuthUser(request);
        if (!auth.ok) {
          return Response.json({ error: auth.error }, { status: auth.status });
        }
        const { userId } = auth;

        if (!rateLimit("checkin", userId, 5, 60)) {
          return Response.json(
            { error: "Rate limit exceeded. Max 5 check-ins per minute." },
            { status: 429 },
          );
        }

        const body = (await request.json()) as {
          type?: "morning" | "evening";
          text?: string;
        };
        const type = body.type === "evening" ? "evening" : "morning";
        const text = (body.text ?? "").trim();
        if (!text) {
          return Response.json({ error: "text is required" }, { status: 400 });
        }

        const { getMemWal, describeMemwalError } = await import("@/lib/memwal.server");
        const { analyzeAndLog } = await import("@/lib/memory-log.server");

        const memwal = getMemWal(userId);
        if (!memwal) {
          return Response.json(
            { error: "Walrus Memory is not configured (MEMWAL_PRIVATE_KEY / MEMWAL_ACCOUNT_ID)." },
            { status: 503 },
          );
        }

        const prefix = type === "morning" ? "Morning check-in" : "Evening review";
        const saved = await analyzeAndLog({
          memwal,
          userId,
          text: `${prefix} (${new Date().toDateString()}): ${text}`,
          source: type,
        });

        let insights = null;
        if (type === "evening") {
          try {
            const { generateInsights } = await import("@/lib/insights.server");
            insights = await generateInsights(userId);
          } catch (error) {
            console.error("insight refresh failed", error);
          }
        }

        return Response.json({
          memories: saved.memories,
          superseded: saved.superseded,
          insights,
          warning: saved.error ? describeMemwalError(saved.error) : null,
        });
      },
    },
  },
});
