-- Migration: Add Supabase Auth support
-- - profiles table gets uuid PK option alongside legacy text IDs
-- - New auth_profiles table links auth.users -> profile data for real users
-- - rate_limit_log for simple per-user sliding window enforcement
-- - Demo user IDs remain as-is (user-alex, user-ada, user-tunde)

-- Add a real-user profiles table keyed by auth.users.id (uuid)
-- This is separate from the demo profiles (legacy text-id table).
-- The app uses SUPABASE_SERVICE_ROLE_KEY (admin) on the server side, so RLS
-- on this table acts as documentation + prevents accidental anon access.
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.user_profiles TO service_role;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
-- Users can only read/write their own profile (when using RLS-aware client)
CREATE POLICY "users own their profile"
  ON public.user_profiles
  FOR ALL
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Extend memories/chat_messages/insights to support uuid user_ids for real users.
-- We add a nullable uuid column; the server sets one XOR the other.
-- (Simpler than altering FK without breaking demo data.)
ALTER TABLE public.memories
  ADD COLUMN IF NOT EXISTS auth_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS memories_auth_user_created_idx
  ON public.memories (auth_user_id, created_at DESC);

ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS auth_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS chat_messages_auth_user_created_idx
  ON public.chat_messages (auth_user_id, created_at);

ALTER TABLE public.insights
  ADD COLUMN IF NOT EXISTS auth_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS insights_auth_user_created_idx
  ON public.insights (auth_user_id, created_at DESC);

-- RLS policies for real users (service_role bypasses all RLS by default)
-- These are belt-and-suspenders; the server enforces auth before any DB call.
CREATE POLICY "real users see own memories"
  ON public.memories
  FOR SELECT
  TO authenticated
  USING (auth_user_id = auth.uid());

CREATE POLICY "real users see own chat messages"
  ON public.chat_messages
  FOR SELECT
  TO authenticated
  USING (auth_user_id = auth.uid());

CREATE POLICY "real users see own insights"
  ON public.insights
  FOR SELECT
  TO authenticated
  USING (auth_user_id = auth.uid());
