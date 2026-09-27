# Déjà Dev: I Built a Standup Bot That Remembers and It Called Out My Three Day Blocker

Every AI chatbot I have ever shipped had the same embarrassing flaw. It greeted every returning user like a stranger. We spend weeks polishing state management in our frontends, then bolt on an AI that forgets everything the second the session closes. The industry band aid is bigger context windows, stuffing raw chat logs into every prompt. That is not memory. It is expensive brute force, and it does not survive across sessions or devices.

So for Walrus Session Eight, I built **Déjà Dev**: a solo developer accountability coach whose entire product *is* memory. Morning check ins, evening reviews, and a bot that remembers your project, your blockers, your energy levels across days, then finds patterns in them. Its tagline: *yesterday remembers what you shipped.*

## The Architecture

The frontend is a React and Vite app with a dark, developer tool aesthetic. The important half of the screen is not the chat, it is a **living memory timeline**. Every fact the bot stores about you, timestamped, grouped by day, growing in real time. When the bot uses a memory, a chip in the chat jumps straight to that timeline entry. Judges should not have to take my word that memory works; they should *see* it.

Under the hood, the chat runs through Groq's gpt oss model (deliberately avoiding the big two providers, as there is a prize track for that), wrapped with the memory middleware from the Walrus Memory SDK. The documented pattern really is that light. Wrap the model once, and every turn automatically recalls relevant memories before generation and extracts facts afterward. Memories are encrypted, stored as blobs on Walrus, indexed for vector search, with ownership enforced by a Sui smart contract. Each user gets an isolated namespace under one operator account. This is the documented multi tenant pattern, requiring no wallets for end users.

Two design decisions mattered. First, the timeline reads from the application database, not from the memory recall. Recall returns no timestamps, so every write is logged with its blob identifier and creation time at write time. Walrus stays the semantic recall layer; the application database is the visible ledger. Second, pattern detection runs on demand. An "Analyze my week" pass pulls seven to fourteen days of memories and asks the model for recurring blockers, velocity trends, and weekday patterns. There are no background daemons or scheduled jobs, just a cached insight refresh after each evening review.

## What Broke

The honest list, because the judges asked for it:

**Credential generation could not be automated.** The Walrus Memory staging dashboard only issues delegate keys after a Google sign in or wallet connect. There is no API or script. It is one manual step, done once, that keys into server side secrets.

**Indexing lag is real.** Write a memory and immediately recall it and you will get nothing, as the vector index trails by seconds. The fix was using the wait write variants everywhere the UI saves then shows, with graceful "indexing" states on timeout.

**Memory is append only, and that bites.** The remember function never updates existing entries. "Stuck on authentication middleware" followed days later by "finished authentication middleware" leaves *both* facts live, and vector similarity can surface the stale one first. I built supersede marking into the application layer. When a status flips, the old timeline entry visibly resolves. Without that, longitudinal memory becomes a hall of mirrors.

**Recall has no relevance threshold by default.** Small namespaces return weak filler matches. Filtering to a specific distance was mandatory, not optional.

**The generated repository committed populated secrets.** The builder dropped real publishable keys and project URLs into the repository. Publishable keys are designed for client code, but a public repository should not carry them. I caught it in review before flipping the repository public.

## The Moment It Changed

Three demo users, seeded with five days of backdated check ins, each carrying a multi day blocker arc. I opened the app as Alex, and the greeting read: *"Morning, Alex. Yesterday you shipped the invoice PDF export at seven out of ten energy, and authentication middleware is on day three. Want to break it down?"*

Nobody told it to say that. No prompt injection, no script. It recalled a shipped item, an energy reading, and a three day old blocker, then *did something with them*. That is the exact behavior the pattern detection pass was built for. That is the difference between transactional AI and relational AI. The bot did not answer a question, it continued a relationship.

## Why This Matters Beyond The Demo

The bug bounty worthy friction I hit is the real story. Append only memory with no staleness signal, indexing lag with no client side story, recall with no default threshold. These are the sharp edges every longitudinal agent will cut itself on. Walrus Memory gets the hard part right: verifiable, portable, user owned state decoupled from any single application, and the SDK middleware makes the happy path genuinely one line. The remaining work is all in the application layer: supersede logic, relevance filtering, and visible ledgers.

Déjà Dev is live, the repository is public, and the bot remembers. Which, finally, is the whole point.

Links: https://github.com/Micoforreal/DejaDev
