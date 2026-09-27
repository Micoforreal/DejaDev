import { createFileRoute } from "@tanstack/react-router";

/**
 * GET /api/diag/memwal — MemWal 401 diagnostic route.
 *
 * Gate: Only callable in dev (NODE_ENV !== "production") OR when the
 * Authorization header matches DIAG_SECRET. Never exposes key material.
 *
 * Returns enough information to pinpoint the exact 401 cause:
 *  - Whether MEMWAL_PRIVATE_KEY / MEMWAL_ACCOUNT_ID are set (booleans only)
 *  - Whether the key normalizes cleanly
 *  - The Sui address derived from the delegate key
 *  - The relayer's reported network
 *  - Whether the account object exists on Sui and lists the key as a delegate
 *  - The x-auth-error header hint from the relayer on a failed probe request
 */
export const Route = createFileRoute("/api/diag/memwal")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        // ── Access gate ─────────────────────────────────────────────────────
        const isDev = process.env["NODE_ENV"] !== "production";
        const diagSecret = process.env["DIAG_SECRET"]?.trim();
        const authHeader = request.headers.get("authorization") ?? "";
        const tokenParam = new URL(request.url).searchParams.get("token") ?? "";
        const providedToken = authHeader.startsWith("Bearer ")
          ? authHeader.slice(7)
          : tokenParam;

        const isOwner = diagSecret && providedToken === diagSecret;

        if (!isDev && !isOwner) {
          return Response.json(
            { error: "Forbidden: set DIAG_SECRET and pass Authorization: Bearer <DIAG_SECRET>" },
            { status: 403 },
          );
        }

        // ── Collect diagnostic information ──────────────────────────────────
        const report: Record<string, unknown> = {
          timestamp: new Date().toISOString(),
          environment: process.env["NODE_ENV"] ?? "unknown",
        };

        // 1. Secret presence (booleans only — never echo values)
        const rawKey = process.env["MEMWAL_PRIVATE_KEY"];
        const rawAccountId = process.env["MEMWAL_ACCOUNT_ID"];
        const key = rawKey?.trim();
        const accountId = rawAccountId?.trim();

        report["secrets"] = {
          MEMWAL_PRIVATE_KEY_set: Boolean(key),
          MEMWAL_ACCOUNT_ID_set: Boolean(accountId),
          GROQ_API_KEY_set: Boolean(process.env["GROQ_API_KEY"]?.trim()),
          // Warn if the raw value had leading/trailing whitespace
          MEMWAL_PRIVATE_KEY_had_whitespace: Boolean(rawKey && rawKey !== key),
          MEMWAL_ACCOUNT_ID_had_whitespace: Boolean(rawAccountId && rawAccountId !== accountId),
        };

        if (!key || !accountId) {
          report["conclusion"] = "BLOCKED: One or both secrets are missing.";
          return Response.json(report);
        }

        // 2. Key normalisation
        try {
          const { normalizePrivateKey } = await import("@mysten-incubation/memwal");
          const normalized = normalizePrivateKey(key);
          report["keyNormalizes"] = Boolean(normalized);
        } catch (err) {
          report["keyNormalizes"] = false;
          report["keyNormalizeError"] = err instanceof Error ? err.message : String(err);
        }

        // 3. Derived Sui address from delegate key
        try {
          const { delegateKeyToSuiAddress } = await import("@mysten-incubation/memwal");
          const suiAddress = delegateKeyToSuiAddress(key);
          report["derivedDelegateAddress"] = suiAddress;
        } catch (err) {
          report["derivedDelegateAddress"] = null;
          report["derivedDelegateAddressError"] = err instanceof Error ? err.message : String(err);
        }

        // 4. Relayer /config — reported network
        const { relayerUrl } = await import("@/lib/memwal.server");
        const relayer = relayerUrl();
        report["relayerUrl"] = relayer;
        try {
          const configRes = await fetch(`${relayer}/config`, {
            signal: AbortSignal.timeout(8000),
          });
          if (configRes.ok) {
            const config = (await configRes.json()) as Record<string, unknown>;
            report["relayerConfig"] = {
              network: config["network"] ?? config["sui_network"] ?? "(not reported)",
              version: config["version"] ?? null,
            };
          } else {
            report["relayerConfig"] = { error: `HTTP ${configRes.status}` };
          }
        } catch (err) {
          report["relayerConfig"] = { error: err instanceof Error ? err.message : String(err) };
        }

        // 5. Sui RPC check — does the account object exist and contain the delegate?
        try {
          const relayerConfigRes = await fetch(`${relayer}/config`, {
            signal: AbortSignal.timeout(8000),
          });
          let suiRpcUrl: string | null = null;
          if (relayerConfigRes.ok) {
            const cfg = (await relayerConfigRes.json()) as Record<string, unknown>;
            suiRpcUrl = (cfg["sui_rpc_url"] ?? cfg["rpc_url"] ?? null) as string | null;
          }

          if (suiRpcUrl) {
            const rpcRes = await fetch(suiRpcUrl, {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                jsonrpc: "2.0",
                id: 1,
                method: "sui_getObject",
                params: [accountId, { showContent: true }],
              }),
              signal: AbortSignal.timeout(10000),
            });
            if (rpcRes.ok) {
              const rpcData = (await rpcRes.json()) as {
                result?: { data?: { content?: { fields?: Record<string, unknown> } } };
                error?: unknown;
              };
              if (rpcData.error) {
                report["suiObjectCheck"] = { exists: false, error: rpcData.error };
              } else {
                const fields = rpcData.result?.data?.content?.fields;
                const delegateKeys = fields?.["delegate_keys"] as unknown[] | undefined;
                const derivedAddr = report["derivedDelegateAddress"] as string | null;
                const isRegistered = derivedAddr
                  ? (delegateKeys ?? []).some(
                      (k) =>
                        typeof k === "string" &&
                        k.toLowerCase() === derivedAddr.toLowerCase(),
                    )
                  : null;
                report["suiObjectCheck"] = {
                  exists: Boolean(rpcData.result?.data),
                  delegateKeysCount: delegateKeys?.length ?? 0,
                  derivedAddressIsRegistered: isRegistered,
                  delegateKeys: delegateKeys ?? [],
                };
              }
            } else {
              report["suiObjectCheck"] = { error: `Sui RPC HTTP ${rpcRes.status}` };
            }
          } else {
            report["suiObjectCheck"] = { skipped: "Could not determine Sui RPC URL from relayer config" };
          }
        } catch (err) {
          report["suiObjectCheck"] = { error: err instanceof Error ? err.message : String(err) };
        }

        // 6. Probe request — collect x-auth-error header
        try {
          const { MemWal } = await import("@mysten-incubation/memwal");
          const memwal = MemWal.create({ key, accountId, serverUrl: relayer, namespace: "dejadev:diag" });
          await memwal.health();
          report["probeResult"] = "ok — health check passed";
          report["authErrorHint"] = null;
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          // Try to extract the x-auth-error header from the error object
          let authErrorHint: string | null = null;
          if (err != null && typeof err === "object") {
            const e = err as Record<string, unknown>;
            const headers = e["headers"] ?? e["responseHeaders"];
            if (headers instanceof Headers) {
              authErrorHint = headers.get("x-auth-error");
            } else if (headers && typeof headers === "object") {
              const h = headers as Record<string, unknown>;
              authErrorHint = (h["x-auth-error"] ?? h["X-Auth-Error"] ?? null) as string | null;
            }
          }
          report["probeResult"] = `failed: ${message}`;
          report["authErrorHint"] = authErrorHint;

          // Derive conclusion
          if (authErrorHint === "ERR_TIMESTAMP_OUT_OF_BOUNDS") {
            report["conclusion"] =
              "CLOCK_DRIFT: Server clock is out of sync. Sync with NTP and retry. This is NOT a key problem.";
          } else if (message.includes("401") || message.toLowerCase().includes("unauthorized")) {
            const isRegistered = (report["suiObjectCheck"] as Record<string, unknown> | undefined)
              ?.["derivedAddressIsRegistered"];
            if (isRegistered === false) {
              report["conclusion"] =
                "KEY_NOT_REGISTERED: The derived delegate address is NOT in the account's delegate_keys list. " +
                "Go to staging.memory.walrus.xyz, open your account, and (re)generate the delegate key. " +
                "Ensure the on-chain registration transaction completes. Copy the new key into MEMWAL_PRIVATE_KEY.";
            } else if (isRegistered === null) {
              report["conclusion"] =
                "CANNOT_VERIFY: Could not check Sui on-chain registration. " +
                "Most likely cause: key not registered on the account. " +
                "Go to staging.memory.walrus.xyz and regenerate the delegate key.";
            } else {
              report["conclusion"] =
                "ENVIRONMENT_MISMATCH or OTHER: The key appears registered but auth still fails. " +
                "Verify that BOTH the account AND the delegate key were created on the staging dashboard " +
                "(staging.memory.walrus.xyz), not the mainnet dashboard. They must match the staging relayer.";
            }
          } else {
            report["conclusion"] = `OTHER_ERROR: ${message}`;
          }
        }

        return Response.json(report, {
          headers: { "cache-control": "no-store" },
        });
      },
    },
  },
});
