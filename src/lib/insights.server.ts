import { generateText } from "ai";
import { getDb } from "./db.server";
import { getGroq, GROQ_MODEL } from "./groq.server";

export type InsightCard = {
  title: string;
  detail: string;
  kind: "blocker" | "velocity" | "rhythm" | "mood" | "nudge";
};

export type InsightPayload = {
  cards: InsightCard[];
  summary: string;
  created_at: string;
};

const ALLOWED_KINDS: InsightCard["kind"][] = ["blocker", "velocity", "rhythm", "mood", "nudge"];

function groupByDay(rows: { text: string; created_at: string; source: string }[]) {
  const days = new Map<string, string[]>();
  for (const row of rows) {
    const day = new Date(row.created_at).toISOString().slice(0, 10);
    const weekday = new Date(row.created_at).toLocaleDateString("en-US", { weekday: "long" });
    const list = days.get(`${day} (${weekday})`) ?? [];
    list.push(`- [${row.source}] ${row.text}`);
    days.set(`${day} (${weekday})`, list);
  }
  return [...days.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([day, lines]) => `${day}\n${lines.join("\n")}`)
    .join("\n\n");
}

export async function generateInsights(userId: string, windowDays = 14): Promise<InsightPayload> {
  const db = await getDb();
  const { isDemoUser } = await import("./db.server");
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString();
  const baseQuery = db
    .from("memories")
    .select("text, created_at, source")
    .gte("created_at", since)
    .order("created_at", { ascending: true })
    .limit(200);

  const { data: rows, error } = isDemoUser(userId)
    ? await baseQuery.eq("user_id", userId)
    : await baseQuery.eq("auth_user_id", userId);

  if (error) throw new Error(error.message);
  if (!rows || rows.length === 0) {
    return { cards: [], summary: "Not enough history yet — run a few check-ins first.", created_at: new Date().toISOString() };
  }

  const groq = getGroq();
  if (!groq) throw new Error("GROQ_API_KEY is not configured");

  const journal = groupByDay(rows as { text: string; created_at: string; source: string }[]);
  const { text } = await generateText({
    model: groq(GROQ_MODEL),
    system:
      "You analyse a solo developer's check-in memory log and detect longitudinal patterns: recurring blockers (count the days), velocity trends, weekday effects, and mood trajectory. Be specific and quantitative. Reply with JSON only.",
    prompt: `Memory log grouped by day:\n\n${journal}\n\nReturn JSON of this exact shape:
{"summary": "two sentences max", "cards": [{"kind": "blocker|velocity|rhythm|mood|nudge", "title": "short, concrete, max 7 words", "detail": "one sentence with the specific evidence"}]}
Rules: 3 to 5 cards. Titles like "3 days on auth middleware" or "Fridays run ~40% lighter". Only claim patterns the log supports. JSON only, no markdown fences.`,
  });

  const cleaned = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  let parsed: { summary?: string; cards?: InsightCard[] } = {};
  try {
    parsed = JSON.parse(cleaned) as typeof parsed;
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        parsed = JSON.parse(match[0]) as typeof parsed;
      } catch {
        parsed = {};
      }
    }
  }

  const cards: InsightCard[] = (parsed.cards ?? [])
    .filter((card) => card && card.title && card.detail)
    .slice(0, 5)
    .map((card) => ({
      title: String(card.title),
      detail: String(card.detail),
      kind: ALLOWED_KINDS.includes(card.kind) ? card.kind : "nudge",
    }));

  const payload: InsightPayload = {
    cards,
    summary: parsed.summary ? String(parsed.summary) : "",
    created_at: new Date().toISOString(),
  };

  const insertPayload = isDemoUser(userId)
    ? { user_id: userId, cards: payload.cards, summary: payload.summary, window_days: windowDays }
    : { auth_user_id: userId, user_id: userId, cards: payload.cards, summary: payload.summary, window_days: windowDays };
  await db.from("insights").insert(insertPayload);

  return payload;
}
