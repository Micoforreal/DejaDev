import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: async () => {
        const { getMemWal, secretStatus, missingSecrets, relayerUrl, describeMemwalError } =
          await import("@/lib/memwal.server");

        const secrets = secretStatus();
        const missing = missingSecrets();
        const memwal = getMemWal();
        if (!memwal) {
          return Response.json({
            status: "unconfigured",
            relayer: relayerUrl(),
            secrets,
            missing,
            error: null,
            authErrorHint: null,
          });
        }

        try {
          const health = await memwal.health();
          return Response.json({
            status: health.status ?? "ok",
            version: health.version ?? null,
            writeReady: health.write_ready ?? null,
            relayer: relayerUrl(),
            secrets,
            missing,
            error: null,
            authErrorHint: null,
          });
        } catch (error) {
          // Extract x-auth-error header hint if the SDK surfaces it
          let authErrorHint: string | null = null;
          if (error != null && typeof error === "object") {
            const err = error as Record<string, unknown>;
            const headers = err["headers"] ?? err["responseHeaders"];
            if (headers instanceof Headers) {
              authErrorHint = headers.get("x-auth-error");
            } else if (headers && typeof headers === "object") {
              const h = headers as Record<string, unknown>;
              authErrorHint = (h["x-auth-error"] ?? h["X-Auth-Error"] ?? null) as string | null;
            }
          }
          return Response.json({
            status: "down",
            relayer: relayerUrl(),
            secrets,
            missing,
            error: describeMemwalError(error),
            authErrorHint,
          });
        }
      },
    },
  },
});
