import { createFileRoute } from "@tanstack/react-router";

/**
 * Streaming chat. Protocol: newline-delimited JSON events.
 *   {"t":"recalled","memories":[...]} | {"t":"delta","v":"..."} |
 *   {"t":"memories","memories":[...],"superseded":[...]} |
 *   {"t":"error","message":"..."} | {"t":"done"}
 *
 * Changes from original:
 * - userId is derived from the verified Supabase session (never from body)
 * - Demo users identified by X-Demo-User-Id header (allow-listed)
 * - Rate-limited: 10 requests/minute per user
 * - withMemWal middleware removed — a single explicit recallForUser pass
 *   injects context at a consistent maxDistance:0.8 threshold
 * - fromCheckin flag: skips analyzeAndLog when the message originated from
 *   the /api/checkin route (avoids duplicate memory writes)
 */
export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { getAuthUser } = await import("@/lib/auth.server");
        const { rateLimit } = await import("@/lib/rate-limit.server");

        const auth = await getAuthUser(request);
        if (!auth.ok) {
          return Response.json({ error: auth.error }, { status: auth.status });
        }
        const { userId, isDemo } = auth;

        if (!rateLimit("chat", userId, 10, 60)) {
          return Response.json(
            { error: "Rate limit exceeded. Slow down — max 10 messages per minute." },
            { status: 429 },
          );
        }

        const body = (await request.json()) as {
          message?: string;
          fromCheckin?: boolean;
        };
        const message = (body.message ?? "").trim();
        const fromCheckin = Boolean(body.fromCheckin);
        if (!message) {
          return Response.json({ error: "message is required" }, { status: 400 });
        }

        const { streamText } = await import("ai");
        const { getGroq, GROQ_MODEL, SYSTEM_PROMPT } = await import("@/lib/groq.server");
        const { getMemWal, describeMemwalError, namespaceFor } = await import(
          "@/lib/memwal.server"
        );
        const { getDb, isDemoUser } = await import("@/lib/db.server");
        const { recallForUser, analyzeAndLog } = await import("@/lib/memory-log.server");

        const groq = getGroq();
        if (!groq) {
          return Response.json(
            { error: "GROQ_API_KEY is not configured. Add it in project settings to enable chat." },
            { status: 503 },
          );
        }

        const db = await getDb();
        const memwal = getMemWal(userId);

        // Demo users: fetch profile from legacy profiles table.
        // Real users: fetch from user_profiles.
        const profileResult = isDemo
          ? await db.from("profiles").select("name").eq("id", userId).maybeSingle()
          : await db.from("user_profiles").select("name").eq("id", userId).maybeSingle();

        // Chat history (last 16 turns)
        const historyResult = isDemoUser(userId)
          ? await db
              .from("chat_messages")
              .select("role, content")
              .eq("user_id", userId)
              .order("created_at", { ascending: false })
              .limit(16)
          : await db
              .from("chat_messages")
              .select("role, content")
              .eq("auth_user_id", userId)
              .order("created_at", { ascending: false })
              .limit(16);

        // Persist the incoming user message
        if (isDemoUser(userId)) {
          await db
            .from("chat_messages")
            .insert({ user_id: userId, role: "user", content: message });
        } else {
          await db.from("chat_messages").insert({
            auth_user_id: userId,
            user_id: userId, // required by NOT NULL FK; real users have a matching profiles row
            role: "user",
            content: message,
          });
        }

        const priorMessages = ((historyResult.data ?? []) as { role: string; content: string }[])
          .reverse()
          .map((row) => ({
            role: row.role === "assistant" ? ("assistant" as const) : ("user" as const),
            content: row.content,
          }));

        // Single explicit recall pass at maxDistance:0.8 — consistent threshold.
        // withMemWal middleware (minRelevance:0.3) has been removed to avoid
        // two different recall passes with conflicting thresholds.
        let recalled: { text: string; blobId: string; distance: number }[] = [];
        let recallError: string | null = null;
        if (memwal) {
          try {
            recalled = await recallForUser(memwal, userId, message, 5);
          } catch (error) {
            recallError = describeMemwalError(error);
          }
        }

        // Fallback so the bot still feels longitudinal before/if the relayer is down.
        if (recalled.length === 0) {
          const fallbackQuery = isDemoUser(userId)
            ? await db
                .from("memories")
                .select("text, created_at")
                .eq("user_id", userId)
                .is("superseded_by", null)
                .order("created_at", { ascending: false })
                .limit(8)
            : await db
                .from("memories")
                .select("text, created_at")
                .eq("auth_user_id", userId)
                .is("superseded_by", null)
                .order("created_at", { ascending: false })
                .limit(8);
          recalled = ((fallbackQuery.data ?? []) as { text: string }[]).map((row) => ({
            text: row.text,
            blobId: "",
            distance: 0.5,
          }));
        }

        const memoryContext = recalled.map((memory) => `- ${memory.text}`).join("\n");
        const profile = profileResult.data;
        const system = `${SYSTEM_PROMPT}

The developer you are talking to is ${profile?.name ?? "this developer"}.
Today is ${new Date().toDateString()}.

MEMORY CONTEXT (facts you already know, recalled from Walrus memory):
${memoryContext || "(no memories yet — this is your first conversation)"}`;

        // Use plain groq model — no withMemWal wrapper. The explicit recallForUser
        // above already injects all relevant context into the system prompt.
        const model = groq(GROQ_MODEL);

        const encoder = new TextEncoder();
        const stream = new ReadableStream<Uint8Array>({
          async start(controller) {
            const send = (event: unknown) =>
              controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
            let assistantText = "";
            try {
              send({ t: "recalled", memories: recalled });
              if (recallError) send({ t: "warn", message: recallError });

              const result = streamText({
                model,
                system,
                messages: [...priorMessages, { role: "user" as const, content: message }],
              });

              for await (const delta of result.textStream) {
                assistantText += delta;
                send({ t: "delta", v: delta });
              }

              // Persist assistant response
              const assistantInsert = isDemoUser(userId)
                ? { user_id: userId, role: "assistant", content: assistantText, recalled: recalled.map((m) => m.text) }
                : { auth_user_id: userId, user_id: userId, role: "assistant", content: assistantText, recalled: recalled.map((m) => m.text) };
              await db.from("chat_messages").insert(assistantInsert);

              // Distil the turn into discrete facts — but ONLY when the message
              // didn't originate from a check-in (avoids duplicate analyzeAndLog).
              if (memwal && message.length > 25 && !fromCheckin) {
                send({ t: "saving" });
                const saved = await analyzeAndLog({
                  memwal,
                  userId,
                  text: `Developer said: ${message}`,
                  source: "chat",
                });
                send({ t: "memories", memories: saved.memories, superseded: saved.superseded });
                if (saved.error) send({ t: "warn", message: describeMemwalError(saved.error) });
              }
              send({ t: "done" });
            } catch (error) {
              console.error("chat failed", error);
              send({ t: "error", message: describeMemwalError(error) });
            } finally {
              controller.close();
            }
          },
        });

        return new Response(stream, {
          headers: {
            "content-type": "application/x-ndjson; charset=utf-8",
            "cache-control": "no-store",
          },
        });
      },
    },
  },
});
