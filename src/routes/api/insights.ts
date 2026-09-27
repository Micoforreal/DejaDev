import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/insights")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { getAuthUser } = await import("@/lib/auth.server");
        const auth = await getAuthUser(request);
        if (!auth.ok) {
          return Response.json({ error: auth.error }, { status: auth.status });
        }
        const { userId } = auth;

        const body = (await request.json()) as { windowDays?: number };

        try {
          const { generateInsights } = await import("@/lib/insights.server");
          const insights = await generateInsights(userId, body.windowDays ?? 14);
          return Response.json({ insights });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          return Response.json({ error: message }, { status: 503 });
        }
      },
    },
  },
});
