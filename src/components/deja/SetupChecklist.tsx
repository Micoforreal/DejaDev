import type { HealthState } from "@/lib/types";

const DESCRIPTIONS: Record<string, string> = {
  MEMWAL_PRIVATE_KEY: "Ed25519 delegate key (hex) from staging.memory.walrus.xyz",
  MEMWAL_ACCOUNT_ID: "Walrus Memory account object ID on Sui, from the same dashboard",
  MEMWAL_SERVER_URL: "Relayer URL (defaults to the staging relayer)",
  GROQ_API_KEY: "Groq API key from console.groq.com — powers the coach",
};

export function SetupChecklist({ health, isDemoMode }: { health: HealthState; isDemoMode?: boolean }) {
  return (
    <div className="mx-auto max-w-xl p-6">
      <div className="panel p-5">
        <h1 className="font-mono text-sm text-foreground">Setup required</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Déjà Dev needs its keys before it can remember anything. Add them in project settings and
          reload.
        </p>

        <ul className="mt-4 space-y-2">
          {Object.entries(health.secrets).map(([name, present]) => (
            <li
              key={name}
              className="flex items-start gap-3 rounded-md border border-hairline bg-surface-raised p-3"
            >
              <span
                className={`mt-0.5 size-2 shrink-0 rounded-full ${present ? "bg-signal" : "bg-blocker"}`}
              />
              <div>
                <p className="font-mono text-xs text-foreground">{name}</p>
                <p className="mt-1 text-xs text-muted-foreground">{DESCRIPTIONS[name]}</p>
              </div>
            </li>
          ))}
        </ul>

        {health.error ? (
          <p className="mt-4 rounded-md border border-blocker/40 p-3 text-xs text-blocker">
            {health.error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
