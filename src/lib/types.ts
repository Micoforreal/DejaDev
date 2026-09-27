export type Profile = { id: string; name: string; handle: string; accent: string };

export type Memory = {
  id: string;
  text: string;
  source: string;
  status: string;
  blob_id: string | null;
  superseded_by: string | null;
  created_at: string;
};

export type InsightCard = {
  title: string;
  detail: string;
  kind: "blocker" | "velocity" | "rhythm" | "mood" | "nudge";
};

export type Insights = { cards: InsightCard[]; summary: string | null; created_at: string };

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  recalled?: string[];
  pending?: boolean;
};

export type HealthState = {
  status: string;
  version?: string | null;
  relayer: string;
  secrets: Record<string, boolean>;
  missing: string[];
  error: string | null;
};

export function dayKey(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

export function dayLabel(iso: string): string {
  const date = new Date(iso);
  const today = new Date();
  const diff = Math.round(
    (new Date(today.toDateString()).getTime() - new Date(date.toDateString()).getTime()) / 86400000,
  );
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return date.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
}

export function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}
