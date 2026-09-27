/** Server-only database access for Déjà Dev routes. */
export async function getDb() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export type MemoryRow = {
  id: string;
  user_id: string;
  text: string;
  namespace: string;
  source: string;
  memory_id: string | null;
  blob_id: string | null;
  job_id: string | null;
  status: string;
  superseded_by: string | null;
  created_at: string;
};

/**
 * Demo user IDs are the three seeded profiles. Real users are identified by
 * their Supabase auth UUID. This distinction controls which DB column is used
 * (user_id text vs auth_user_id uuid) and whether the request bypasses auth.
 */
export const DEMO_USER_IDS = ["user-alex", "user-ada", "user-tunde"] as const;
export type DemoUserId = (typeof DEMO_USER_IDS)[number];

export function isDemoUser(userId: string): boolean {
  return (DEMO_USER_IDS as readonly string[]).includes(userId);
}
