# Déjà Dev

--- BUILD PROMPT BEGINS ---

# Déjà Dev — Lovable Build Prompt

**Walrus Session 8: Chatbots That Remember** hackathon entry. Deadline: Oct 9, 2026.



## What to build

**Déjà Dev** — a solo-developer accountability chatbot whose entire value is persistent memory. It runs morning check-ins and evening reviews, remembers the developer's project, blockers, mood, and velocity across days, and surfaces patterns no stateless bot could see. Tagline: "Yesterday remembers what you shipped."

The single most important screen: alongside the chat, a **living memory timeline** — every fact the bot has stored about the user, timestamped, growing in real time.



### The wow moment (engineer for this)

After a few days of check-ins, the bot unprompted says something like: "Auth middleware again — that's day 3 on this blocker. And your output dips ~40% every Friday. Want to break the auth task down and move deep work to mornings?" Longitudinal memory + pattern detection. Nothing stateless can fake this.



## Tech stack (exact)

- Frontend: React + Vite + Tailwind (Lovable default). Dark, dev-tool aesthetic — think Linear/Vercel: near-black background, monospace accents, subtle borders. No purple/blue gradients, no generic AI-chatbot look.

- Backend: Lovable edge functions (server). npm (not pnpm).

- LLM: Groq ONLY — `openai/gpt-oss-20b` via `@ai-sdk/groq`. Zero OpenAI or Anthropic usage anywhere.

- Memory: `@mysten-incubation/memwal` (Walrus Memory SDK) pointed at the staging relayer.

- Packages to install: `@mysten-incubation/memwal`, `ai`, `zod`, `@ai-sdk/groq`.



### Secrets (server-side ONLY — never in client bundles, never in the repo)

- MEMWAL_PRIVATE_KEY — Ed25519 delegate private key (hex), generated at https://staging.memory.walrus.xyz

- MEMWAL_ACCOUNT_ID — Walrus Memory account object ID on Sui (from the same dashboard)

- MEMWAL_SERVER_URL — https://relayer-staging.memory.walrus.xyz

- GROQ_API_KEY — the user adds this himself later; if missing, show a clear setup notice, not a crash.



### MemWal integration (follow exactly)

```ts

import { MemWal } from "@mysten-incubation/memwal";

import { withMemWal } from "@mysten-incubation/memwal/ai";

import { groq } from "@ai-sdk/groq";



const memwal = MemWal.create({

  key: process.env.MEMWAL_PRIVATE_KEY!,

  accountId: process.env.MEMWAL_ACCOUNT_ID!,

  serverUrl: process.env.MEMWAL_SERVER_URL ?? "https://relayer-staging.memory.walrus.xyz",

  namespace: "dejadev",

});



// Per request, namespace isolates one user's memories: `dejadev:<user-id>` (e.g. "dejadev:user-alex").

// Namespaces are exact, case-sensitive, flat strings.

const model = withMemWal(groq("openai/gpt-oss-20b"), {

  key: process.env.MEMWAL_PRIVATE_KEY!,

  accountId: process.env.MEMWAL_ACCOUNT_ID!,

  serverUrl: "https://relayer-staging.memory.walrus.xyz",

  namespace: `dejadev:${userId}`,

  maxMemories: 5,

  autoSave: true,

  minRelevance: 0.3,

});

```

Critical rules:

1. Indexing lags a few seconds — always use `rememberAndWait(text, namespace, { timeoutMs: 25000 })` and `analyzeAndWait(text, namespace, { timeoutMs: 25000 })` when the UI saves then immediately shows. Keep timeoutMs ≤ 25000. On timeout, fall back gracefully and mark the timeline entry "indexing…".

2. Recall has NO default relevance threshold — always pass `maxDistance: 0.8` and filter to `distance < 0.8`. Distance guide: <0.25 duplicate, 0.25–0.55 related, 0.55–0.8 weak, ≥0.8 unrelated (drop).

3. `remember()` is APPEND-ONLY, never upsert. Handle staleness app-side: before writing a status fact, recall for contradicting facts; when status flips, write the new fact and mark the old timeline entry as superseded (visible as resolved).

4. Extract structured facts from check-ins with `analyzeAndWait(checkinText, namespace)` → `{ facts: [{ text, id, job_id, blob_id }] }`. Use after every morning/evening check-in.

5. 401 Unauthorized = wrong key / key not on account / account ID mismatch / staging-vs-mainnet mismatch. Surface a readable error.



### Per-user identity

One operator MemWal account, held server-side. App users are plain profiles (name + stable id). Seed 3 demo users (Alex, Ada, Tunde) with a user-switcher in the UI. No Sui wallets for end users.



### Memory timeline (app DB, NOT MemWal recall)

MemWal recall returns no timestamps, so the timeline reads from the app's own database. Every rememberAndWait/analyzeAndWait call must log `{ memoryId, blobId, text, userId, namespace, createdAt, supersededBy? }` at write time. Timeline lists newest-first, grouped by day, with "resolved" state for superseded facts.



### Pattern detection ("Insights")

No daemons/cron (edge functions are request-scoped). On-demand: an "Analyze my week" button + auto-run after each evening review. (1) Pull the user's last 7–14 days of memories from the app DB grouped by day, (2) one Groq summarization call with a pattern-detection prompt (recurring blockers, velocity trends, weekday patterns, mood trajectory), (3) cache result in app DB with timestamp. Render insight cards like "3 days on auth middleware", "Fridays run ~40% lighter". Stay under Groq free-tier limits (30 RPM / 8K TPM) — chunk by week if large.



### Edge-function routes

- POST /api/chat — streaming chat, per-user namespace via withMemWal

- POST /api/checkin — { userId, type: "morning"|"evening", text } → analyzeAndWait → log facts to app DB

- GET /api/memories?userId= — timeline from app DB

- POST /api/insights — pattern-detection pass, cached

- GET /api/health — MemWal relayer health check → status pill in UI



### Bot personality (system prompt)

A sharp, warm accountability coach for solo developers. Proactive: distills check-ins into fact-style sentences, references specific past memories unprompted ("last Tuesday you said…"), never asks for info it already has. Must keep referencing stored context every turn — never go quiet/generic after a few memories.



### Check-in flows

- Morning: "What are you shipping today? Anything carrying over?" → goals + carried blockers via analyzeAndWait.

- Evening: "What got done? What's still stuck? Energy level?" → shipped items, open blockers, mood → trigger Insights refresh.



## Seed data

Include a seed script (or documented manual steps) creating realistic backdated check-ins for the 3 demo users across ~5 days — each user ends with 10+ memories, including one multi-day recurring blocker (the "auth middleware, 3 days" arc) so the wow moment is reproducible on first view.



## UI layout

- Left: chat (streaming, markdown, memory-reference chips — when the bot uses a memory, show a chip like "recalled: auth blocker · Tue" jumping to the timeline entry).

- Right: memory timeline (growing, timestamped, day-grouped, superseded states) + Insights cards on top + relayer status pill.

- Top bar: user switcher (Alex / Ada / Tunde), "Analyze my week" button.

- First-run: if secrets are missing, show a setup checklist screen.



## Definition of done

- Chat works end-to-end with Groq + MemWal staging; memories persist across sessions (prove: reload, bot still knows you)

- Check-ins extract discrete facts via analyzeAndWait, visible in timeline within seconds

- Timeline shows 10+ timestamped memories per demo user after seeding

- "Analyze my week" produces insight cards

- No OpenAI/Anthropic imports anywhere; no secrets in client code or repo

- README: setup steps, env vars, architecture diagram (chat → edge function → Groq + MemWal → Walrus/Sui), demo instructions

- Deployed on a public Lovable URL



## Out of scope

Ollama/local models, background cron jobs, end-user Sui wallets, real deletion of memories (MemWal `forget` only removes index rows — note honestly in README).

--- BUILD PROMPT ENDS ---



Name this project "Déjà Dev".

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://deja-dev-memory-coach.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/e45e4a32-24f1-4566-8651-5fb1b348acb2).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
