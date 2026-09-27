
CREATE TABLE public.profiles (
  id text PRIMARY KEY,
  name text NOT NULL,
  handle text NOT NULL,
  accent text NOT NULL DEFAULT 'emerald',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.profiles TO anon, authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles are public" ON public.profiles FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.memories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  text text NOT NULL,
  namespace text NOT NULL,
  source text NOT NULL DEFAULT 'chat',
  memory_id text,
  blob_id text,
  job_id text,
  status text NOT NULL DEFAULT 'indexed',
  superseded_by uuid REFERENCES public.memories(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX memories_user_created_idx ON public.memories (user_id, created_at DESC);
GRANT SELECT ON public.memories TO anon, authenticated;
GRANT ALL ON public.memories TO service_role;
ALTER TABLE public.memories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "memories are public" ON public.memories FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role text NOT NULL,
  content text NOT NULL,
  recalled jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX chat_messages_user_created_idx ON public.chat_messages (user_id, created_at);
GRANT SELECT ON public.chat_messages TO anon, authenticated;
GRANT ALL ON public.chat_messages TO service_role;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "chat messages are public" ON public.chat_messages FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  cards jsonb NOT NULL DEFAULT '[]'::jsonb,
  summary text,
  window_days integer NOT NULL DEFAULT 14,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX insights_user_created_idx ON public.insights (user_id, created_at DESC);
GRANT SELECT ON public.insights TO anon, authenticated;
GRANT ALL ON public.insights TO service_role;
ALTER TABLE public.insights ENABLE ROW LEVEL SECURITY;
CREATE POLICY "insights are public" ON public.insights FOR SELECT TO anon, authenticated USING (true);

INSERT INTO public.profiles (id, name, handle, accent) VALUES
  ('user-alex', 'Alex', 'alex', 'emerald'),
  ('user-ada', 'Ada', 'ada', 'amber'),
  ('user-tunde', 'Tunde', 'tunde', 'sky');

INSERT INTO public.memories (user_id, text, namespace, source, status, created_at) VALUES
  ('user-alex', 'Alex is building Orbit, a solo SaaS for freelance invoicing, in TypeScript and Postgres.', 'dejadev:user-alex', 'morning', 'indexed', now() - interval '5 days' - interval '3 hours'),
  ('user-alex', 'On day 1 Alex planned to ship the Stripe webhook handler and start auth middleware.', 'dejadev:user-alex', 'morning', 'indexed', now() - interval '5 days' - interval '3 hours'),
  ('user-alex', 'Alex shipped the Stripe webhook handler and rated energy 8/10.', 'dejadev:user-alex', 'evening', 'indexed', now() - interval '5 days' + interval '6 hours'),
  ('user-alex', 'Alex is blocked on auth middleware: refresh tokens are rejected after the first rotation.', 'dejadev:user-alex', 'evening', 'indexed', now() - interval '4 days' + interval '6 hours'),
  ('user-alex', 'Alex carried the auth middleware blocker into a second day and shipped only the settings page.', 'dejadev:user-alex', 'evening', 'indexed', now() - interval '3 days' + interval '6 hours'),
  ('user-alex', 'Alex is still blocked on auth middleware for a third day and described feeling frustrated.', 'dejadev:user-alex', 'evening', 'indexed', now() - interval '2 days' + interval '6 hours'),
  ('user-alex', 'Alex does deep work best before noon and loses focus after 4pm.', 'dejadev:user-alex', 'chat', 'indexed', now() - interval '3 days' + interval '2 hours'),
  ('user-alex', 'Alex shipped almost nothing on Friday and called it a low-energy day, 3/10.', 'dejadev:user-alex', 'evening', 'indexed', now() - interval '2 days' + interval '7 hours'),
  ('user-alex', 'Alex plans to break the auth middleware task into token rotation, session store, and tests.', 'dejadev:user-alex', 'morning', 'indexed', now() - interval '1 days' - interval '3 hours'),
  ('user-alex', 'Alex shipped the invoice PDF export and rated energy 7/10.', 'dejadev:user-alex', 'evening', 'indexed', now() - interval '1 days' + interval '6 hours'),
  ('user-alex', 'Alex prefers short, direct accountability nudges over long pep talks.', 'dejadev:user-alex', 'chat', 'indexed', now() - interval '4 days' + interval '1 hours'),
  ('user-alex', 'Alex works alone and has no code reviewer, so blockers tend to last multiple days.', 'dejadev:user-alex', 'chat', 'indexed', now() - interval '2 days' + interval '1 hours'),
  ('user-ada', 'Ada is building Lumen, an offline-first notes app, with React and SQLite WASM.', 'dejadev:user-ada', 'morning', 'indexed', now() - interval '5 days' - interval '2 hours'),
  ('user-ada', 'Ada shipped the sync conflict resolver and rated energy 9/10.', 'dejadev:user-ada', 'evening', 'indexed', now() - interval '5 days' + interval '7 hours'),
  ('user-ada', 'Ada is blocked on IndexedDB quota errors in Safari.', 'dejadev:user-ada', 'evening', 'indexed', now() - interval '4 days' + interval '7 hours'),
  ('user-ada', 'Ada is still fighting the Safari storage quota bug on a second day.', 'dejadev:user-ada', 'evening', 'indexed', now() - interval '3 days' + interval '7 hours'),
  ('user-ada', 'Ada resolved the Safari storage quota bug by switching to origin private file system.', 'dejadev:user-ada', 'evening', 'indexed', now() - interval '2 days' + interval '7 hours'),
  ('user-ada', 'Ada codes late at night and is slowest in the morning.', 'dejadev:user-ada', 'chat', 'indexed', now() - interval '4 days' + interval '2 hours'),
  ('user-ada', 'Ada plans to ship the tag filter UI and the keyboard shortcut palette.', 'dejadev:user-ada', 'morning', 'indexed', now() - interval '2 days' - interval '2 hours'),
  ('user-ada', 'Ada shipped the keyboard shortcut palette and rated energy 8/10.', 'dejadev:user-ada', 'evening', 'indexed', now() - interval '1 days' + interval '7 hours'),
  ('user-ada', 'Ada tends to over-scope Mondays and under-deliver on them.', 'dejadev:user-ada', 'chat', 'indexed', now() - interval '3 days' + interval '3 hours'),
  ('user-ada', 'Ada wants to launch Lumen on Product Hunt within three weeks.', 'dejadev:user-ada', 'chat', 'indexed', now() - interval '5 days' + interval '3 hours'),
  ('user-ada', 'Ada is blocked on writing landing page copy and keeps postponing it.', 'dejadev:user-ada', 'evening', 'indexed', now() - interval '1 days' + interval '8 hours'),
  ('user-tunde', 'Tunde is building Relay, a webhook debugging tool, in Go with a React dashboard.', 'dejadev:user-tunde', 'morning', 'indexed', now() - interval '5 days' - interval '1 hours'),
  ('user-tunde', 'Tunde shipped the request replay endpoint and rated energy 7/10.', 'dejadev:user-tunde', 'evening', 'indexed', now() - interval '5 days' + interval '5 hours'),
  ('user-tunde', 'Tunde is blocked on flaky integration tests that fail only in CI.', 'dejadev:user-tunde', 'evening', 'indexed', now() - interval '4 days' + interval '5 hours'),
  ('user-tunde', 'Tunde spent a second day on the flaky CI tests without a fix.', 'dejadev:user-tunde', 'evening', 'indexed', now() - interval '3 days' + interval '5 hours'),
  ('user-tunde', 'Tunde spent a third day on flaky CI tests and suspects a shared Postgres container.', 'dejadev:user-tunde', 'evening', 'indexed', now() - interval '2 days' + interval '5 hours'),
  ('user-tunde', 'Tunde does his best work in two-hour focused blocks with no Slack.', 'dejadev:user-tunde', 'chat', 'indexed', now() - interval '4 days' + interval '1 hours'),
  ('user-tunde', 'Tunde has a day job and only codes on Relay between 7pm and 10pm.', 'dejadev:user-tunde', 'chat', 'indexed', now() - interval '5 days' + interval '2 hours'),
  ('user-tunde', 'Tunde plans to ship the payload diff viewer this week.', 'dejadev:user-tunde', 'morning', 'indexed', now() - interval '2 days' - interval '1 hours'),
  ('user-tunde', 'Tunde shipped the payload diff viewer and rated energy 6/10.', 'dejadev:user-tunde', 'evening', 'indexed', now() - interval '1 days' + interval '5 hours'),
  ('user-tunde', 'Tunde skips evening reviews on Fridays because he is usually out.', 'dejadev:user-tunde', 'chat', 'indexed', now() - interval '3 days' + interval '2 hours'),
  ('user-tunde', 'Tunde wants to reach ten paying users before he adds new features.', 'dejadev:user-tunde', 'chat', 'indexed', now() - interval '4 days' + interval '3 hours');

UPDATE public.memories m
SET superseded_by = newer.id
FROM public.memories newer
WHERE m.user_id = 'user-ada'
  AND m.text = 'Ada is blocked on IndexedDB quota errors in Safari.'
  AND newer.user_id = 'user-ada'
  AND newer.text = 'Ada resolved the Safari storage quota bug by switching to origin private file system.';

UPDATE public.memories m
SET superseded_by = newer.id
FROM public.memories newer
WHERE m.user_id = 'user-ada'
  AND m.text = 'Ada is still fighting the Safari storage quota bug on a second day.'
  AND newer.user_id = 'user-ada'
  AND newer.text = 'Ada resolved the Safari storage quota bug by switching to origin private file system.';

INSERT INTO public.chat_messages (user_id, role, content, created_at) VALUES
  ('user-alex', 'assistant', 'Morning, Alex. Yesterday you shipped the invoice PDF export at 7/10 energy — and auth middleware is still open. Want to start with the token rotation slice?', now() - interval '1 days' - interval '3 hours');
