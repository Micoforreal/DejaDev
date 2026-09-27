import type { HealthState, Profile } from "@/lib/types";

type Props = {
  isDemoMode: boolean;
  demoProfiles: Profile[];
  activeDemoUserId: string | null;
  onDemoSwitch?: (userId: string) => void;
  userName: string;
  onAnalyze: () => void;
  analyzing: boolean;
  health: HealthState | null;
  onSignOut: () => void;
};

function statusTone(health: HealthState | null) {
  if (!health) return { label: "relayer · checking", color: "bg-muted-foreground" };
  if (health.status === "unconfigured")
    return { label: "relayer · not configured", color: "bg-warn" };
  if (health.status === "down") return { label: "relayer · unreachable", color: "bg-blocker" };
  return { label: `relayer · ${health.status}`, color: "bg-signal" };
}

export function TopBar({
  isDemoMode,
  demoProfiles,
  activeDemoUserId,
  onDemoSwitch,
  userName,
  onAnalyze,
  analyzing,
  health,
  onSignOut,
}: Props) {
  const tone = statusTone(health);

  return (
    <header className="flex flex-wrap items-center gap-3 border-b border-hairline bg-surface/60 px-4 py-3 backdrop-blur sm:px-6">
      <div className="flex items-baseline gap-2">
        <span className="font-mono text-sm font-semibold tracking-tight text-foreground">
          déjà<span className="text-signal">·</span>dev
        </span>
        <span className="hidden text-xs text-muted-foreground sm:inline">
          Yesterday remembers what you shipped.
        </span>
      </div>

      <div className="ml-auto flex flex-wrap items-center gap-2">
        {/* Demo mode: show user switcher */}
        {isDemoMode && demoProfiles.length > 0 && onDemoSwitch && (
          <>
            <span className="rounded border border-warn/40 px-2 py-1 font-mono text-[10px] text-warn">
              demo
            </span>
            <div className="flex items-center rounded-md border border-hairline bg-surface-raised p-0.5">
              {demoProfiles.map((profile) => (
                <button
                  key={profile.id}
                  type="button"
                  onClick={() => onDemoSwitch(profile.id)}
                  className={`rounded-[5px] px-3 py-1.5 font-mono text-xs transition-colors ${
                    profile.id === activeDemoUserId
                      ? "bg-signal text-signal-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {profile.name}
                </button>
              ))}
            </div>
          </>
        )}

        {/* Real user: show name */}
        {!isDemoMode && (
          <span className="font-mono text-xs text-muted-foreground">
            {userName}
          </span>
        )}

        <button
          type="button"
          onClick={onAnalyze}
          disabled={analyzing}
          className="rounded-md border border-hairline bg-surface-raised px-3 py-1.5 font-mono text-xs text-foreground transition-colors hover:border-signal hover:text-signal disabled:opacity-50"
        >
          {analyzing ? "analyzing…" : "Analyze my week"}
        </button>

        <span className="flex items-center gap-2 rounded-md border border-hairline px-2.5 py-1.5 font-mono text-[11px] text-muted-foreground">
          <span className={`size-1.5 rounded-full ${tone.color} live-dot`} />
          {tone.label}
        </span>

        <button
          type="button"
          id="sign-out-button"
          onClick={onSignOut}
          className="rounded-md border border-hairline bg-surface-raised px-3 py-1.5 font-mono text-xs text-muted-foreground transition-colors hover:border-blocker/50 hover:text-blocker"
        >
          {isDemoMode ? "exit demo" : "sign out"}
        </button>
      </div>
    </header>
  );
}
