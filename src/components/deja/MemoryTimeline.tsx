import { dayKey, dayLabel, timeLabel, type Memory } from "@/lib/types";

const SOURCE_LABEL: Record<string, string> = {
  morning: "morning",
  evening: "evening",
  chat: "chat",
  seed: "seed",
};

export function MemoryTimeline({
  memories,
  highlightId,
}: {
  memories: Memory[];
  highlightId: string | null;
}) {
  const groups = new Map<string, Memory[]>();
  for (const memory of memories) {
    const key = dayKey(memory.created_at);
    const list = groups.get(key) ?? [];
    list.push(memory);
    groups.set(key, list);
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="mono-label">Memory timeline</h2>
        <span className="font-mono text-[10px] text-muted-foreground">
          {memories.length} memories
        </span>
      </div>

      {memories.length === 0 ? (
        <div className="panel p-3 text-xs text-muted-foreground">
          Nothing remembered yet. Run a morning check-in.
        </div>
      ) : null}

      <div className="space-y-4">
        {[...groups.entries()].map(([key, items]) => (
          <div key={key} className="space-y-2">
            <div className="sticky top-0 z-10 flex items-center gap-2 bg-background/90 py-1 backdrop-blur">
              <span className="font-mono text-[11px] text-foreground">
                {dayLabel(items[0]!.created_at)}
              </span>
              <span className="h-px flex-1 bg-hairline" />
              <span className="font-mono text-[10px] text-muted-foreground">{items.length}</span>
            </div>

            {items.map((memory) => {
              const superseded = Boolean(memory.superseded_by);
              return (
                <article
                  key={memory.id}
                  id={`memory-${memory.id}`}
                  className={`enter panel p-3 transition-colors ${
                    highlightId === memory.id ? "border-signal" : ""
                  } ${superseded ? "opacity-55" : ""}`}
                >
                  <div className="flex items-center gap-2">
                    <span className="mono-label">{SOURCE_LABEL[memory.source] ?? memory.source}</span>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {timeLabel(memory.created_at)}
                    </span>
                    {memory.status === "indexing" ? (
                      <span className="rounded border border-warn/40 px-1.5 py-0.5 font-mono text-[10px] text-warn">
                        indexing…
                      </span>
                    ) : null}
                    {superseded ? (
                      <span className="rounded border border-hairline px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                        resolved
                      </span>
                    ) : null}
                  </div>
                  <p
                    className={`mt-1.5 text-sm leading-relaxed ${
                      superseded ? "text-muted-foreground line-through decoration-hairline" : ""
                    }`}
                  >
                    {memory.text}
                  </p>
                  {memory.blob_id ? (
                    <p className="mt-1.5 truncate font-mono text-[10px] text-muted-foreground">
                      walrus:{memory.blob_id.slice(0, 18)}…
                    </p>
                  ) : null}
                </article>
              );
            })}
          </div>
        ))}
      </div>
    </section>
  );
}
