import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/article")({
  head: () => ({
    meta: [
      { title: "Article — Déjà Dev" },
      { name: "description", content: "Déjà Dev: I Built a Standup Bot That Remembers" },
    ],
  }),
  component: ArticlePage,
});

function ArticlePage() {
  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-signal/30">
      <div className="mx-auto max-w-3xl px-6 py-16 md:py-24">
        <Link 
          to="/" 
          className="inline-flex items-center text-sm font-mono text-muted-foreground hover:text-signal transition-colors mb-12"
        >
          ← Back to app
        </Link>
        
        <article className="max-w-none">
          <header className="mb-14">
            <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-foreground mb-4 leading-tight">
              Déjà Dev: I Built a Standup Bot That Remembers and It Called Out My Three Day Blocker
            </h1>
            <div className="flex items-center gap-3 text-sm font-mono text-muted-foreground">
              <span>Walrus Session Eight</span>
              <span className="text-hairline">•</span>
              <span>Project Article</span>
            </div>
          </header>

          <div className="space-y-6 text-base leading-relaxed text-muted-foreground">
            <p className="text-foreground font-medium">
              Every AI chatbot I have ever shipped had the same embarrassing flaw. It greeted every returning user like a stranger. We spend weeks polishing state management in our frontends, then bolt on an AI that forgets everything the second the session closes. The industry band aid is bigger context windows, stuffing raw chat logs into every prompt. That is not memory. It is expensive brute force, and it does not survive across sessions or devices.
            </p>

            <p>
              So for Walrus Session Eight, I built <strong className="text-foreground font-semibold">Déjà Dev</strong>: a solo developer accountability coach whose entire product <em>is</em> memory. Morning check ins, evening reviews, and a bot that remembers your project, your blockers, your energy levels across days, then finds patterns in them. Its tagline: <em className="text-foreground">yesterday remembers what you shipped.</em>
            </p>

            <h2 className="text-xl font-semibold text-foreground mt-12 mb-4">The Architecture</h2>
            
            <p>
              The frontend is a React and Vite app with a dark, developer tool aesthetic. The important half of the screen is not the chat, it is a <strong className="text-foreground font-semibold">living memory timeline</strong>. Every fact the bot stores about you, timestamped, grouped by day, growing in real time. When the bot uses a memory, a chip in the chat jumps straight to that timeline entry. Judges should not have to take my word that memory works; they should <em>see</em> it.
            </p>
            
            <p>
              Under the hood, the chat runs through Groq's gpt oss model (deliberately avoiding the big two providers, as there is a prize track for that), wrapped with the memory middleware from the Walrus Memory SDK. The documented pattern really is that light. Wrap the model once, and every turn automatically recalls relevant memories before generation and extracts facts afterward. Memories are encrypted, stored as blobs on Walrus, indexed for vector search, with ownership enforced by a Sui smart contract. Each user gets an isolated namespace under one operator account. This is the documented multi tenant pattern, requiring no wallets for end users.
            </p>

            <p>
              Two design decisions mattered. First, the timeline reads from the application database, not from the memory recall. Recall returns no timestamps, so every write is logged with its blob identifier and creation time at write time. Walrus stays the semantic recall layer; the application database is the visible ledger. Second, pattern detection runs on demand. An "Analyze my week" pass pulls seven to fourteen days of memories and asks the model for recurring blockers, velocity trends, and weekday patterns. There are no background daemons or scheduled jobs, just a cached insight refresh after each evening review.
            </p>

            <h2 className="text-xl font-semibold text-foreground mt-12 mb-4">What Broke</h2>
            
            <p>The honest list, because the judges asked for it:</p>

            <ul className="list-disc pl-6 space-y-4">
              <li>
                <strong className="text-foreground font-semibold">Credential generation could not be automated.</strong> The Walrus Memory staging dashboard only issues delegate keys after a Google sign in or wallet connect. There is no API or script. It is one manual step, done once, that keys into server side secrets.
              </li>
              <li>
                <strong className="text-foreground font-semibold">Indexing lag is real.</strong> Write a memory and immediately recall it and you will get nothing, as the vector index trails by seconds. The fix was using the wait write variants everywhere the UI saves then shows, with graceful "indexing" states on timeout.
              </li>
              <li>
                <strong className="text-foreground font-semibold">Memory is append only, and that bites.</strong> The remember function never updates existing entries. "Stuck on authentication middleware" followed days later by "finished authentication middleware" leaves <em>both</em> facts live, and vector similarity can surface the stale one first. I built supersede marking into the application layer. When a status flips, the old timeline entry visibly resolves. Without that, longitudinal memory becomes a hall of mirrors.
              </li>
              <li>
                <strong className="text-foreground font-semibold">Recall has no relevance threshold by default.</strong> Small namespaces return weak filler matches. Filtering to a specific distance was mandatory, not optional.
              </li>
              <li>
                <strong className="text-foreground font-semibold">The generated repository committed populated secrets.</strong> The builder dropped real publishable keys and project URLs into the repository. Publishable keys are designed for client code, but a public repository should not carry them. I caught it in review before flipping the repository public.
              </li>
            </ul>

            <h2 className="text-xl font-semibold text-foreground mt-12 mb-4">The Moment It Changed</h2>

            <p>
              Three demo users, seeded with five days of backdated check ins, each carrying a multi day blocker arc. I opened the app as Alex, and the greeting read: <em className="text-foreground">"Morning, Alex. Yesterday you shipped the invoice PDF export at seven out of ten energy, and authentication middleware is on day three. Want to break it down?"</em>
            </p>

            <p>
              Nobody told it to say that. No prompt injection, no script. It recalled a shipped item, an energy reading, and a three day old blocker, then <em>did something with them</em>. That is the exact behavior the pattern detection pass was built for. That is the difference between transactional AI and relational AI. The bot did not answer a question, it continued a relationship.
            </p>

            <h2 className="text-xl font-semibold text-foreground mt-12 mb-4">Why This Matters Beyond The Demo</h2>

            <p>
              The bug bounty worthy friction I hit is the real story. Append only memory with no staleness signal, indexing lag with no client side story, recall with no default threshold. These are the sharp edges every longitudinal agent will cut itself on. Walrus Memory gets the hard part right: verifiable, portable, user owned state decoupled from any single application, and the SDK middleware makes the happy path genuinely one line. The remaining work is all in the application layer: supersede logic, relevance filtering, and visible ledgers.
            </p>

            <p>
              Déjà Dev is live, the repository is public, and the bot remembers. Which, finally, is the whole point.
            </p>

            <div className="mt-12 pt-8 border-t border-hairline">
              <a 
                href="https://github.com/Micoforreal/DejaDev" 
                target="_blank" 
                rel="noreferrer" 
                className="inline-flex items-center gap-2 text-sm font-mono text-signal hover:underline"
              >
                View Project Repository ↗
              </a>
            </div>
          </div>
        </article>
      </div>
    </div>
  );
}
