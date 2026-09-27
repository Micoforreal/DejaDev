import type { Insights } from "@/lib/types";

const KIND_STYLE: Record<string, string> = {
  blocker: "text-blocker border-blocker/40",
  velocity: "text-signal border-signal/40",
  rhythm: "text-mood border-mood/40",
  mood: "text-warn border-warn/40",
  nudge: "text-foreground border-hairline",
};

export function InsightsPanel({
  insights,
  analyzing,
  hasMemories,
}: {
  insights: Insights | null;
  analyzing: boolean;
  hasMemories?: boolean;
}) {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="mono-label">Insights</h2>
        {insights?.created_at ? (
          <span className="font-mono text-[10px] text-muted-foreground">
            {new Date(insights.created_at).toLocaleString("en-US", {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        ) : null}
      </div>

      {analyzing ? (
        <div className="panel p-3 font-mono text-xs text-muted-foreground">
          reading the last 14 days…
        </div>
      ) : null}

      {!analyzing && (!insights || insights.cards.length === 0) ? (
        <div className="panel p-3 text-xs text-muted-foreground">
          {hasMemories === false ? (
            "Run a few check-ins first. I'll detect patterns across your days once there's history."
          ) : (
            <>
              No patterns yet. Hit <span className="font-mono text-foreground">Analyze my week</span> to
              look across the whole memory log.
            </>
          )}
        </div>
      ) : null}

      <div className="grid gap-2">
        {(insights?.cards ?? []).map((card, index) => (
          <article
            key={`${card.title}-${index}`}
            className={`enter panel border-l-2 p-3 ${KIND_STYLE[card.kind] ?? KIND_STYLE["nudge"]}`}
          >
            <p className="font-mono text-xs font-medium">{card.title}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{card.detail}</p>
          </article>
        ))}
      </div>

      {insights?.summary ? (
        <p className="px-1 text-xs leading-relaxed text-muted-foreground">{insights.summary}</p>
      ) : null}
    </section>
  );
}
