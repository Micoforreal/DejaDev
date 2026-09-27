import { createFileRoute } from "@tanstack/react-router";

/**
 * POST /api/auth/signup
 * Body: { email, password, name }
 * Creates a Supabase auth user and inserts a user_profiles row.
 * Returns: { userId, name } on success.
 */
export const Route = createFileRoute("/api/auth/signup")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json()) as {
          email?: string;
          password?: string;
          name?: string;
        };
        const email = (body.email ?? "").trim().toLowerCase();
        const password = (body.password ?? "").trim();
        const name = (body.name ?? "").trim();

        if (!email || !password || !name) {
          return Response.json(
            { error: "email, password, and name are required." },
            { status: 400 },
          );
        }
        if (password.length < 8) {
          return Response.json(
            { error: "Password must be at least 8 characters." },
            { status: 400 },
          );
        }

        const SUPABASE_URL = process.env["SUPABASE_URL"]?.trim();
        const SUPABASE_SERVICE_ROLE_KEY = process.env["SUPABASE_SERVICE_ROLE_KEY"]?.trim();
        if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
          return Response.json({ error: "Supabase is not configured." }, { status: 503 });
        }

        const { createClient } = await import("@supabase/supabase-js");
        const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
          auth: { persistSession: false, autoRefreshToken: false },
        });

        // Create auth user
        const { data: signUpData, error: signUpError } = await admin.auth.admin.createUser({
          email,
          password,
          email_confirm: true, // auto-confirm so no email required for hackathon
        });

        if (signUpError) {
          // Supabase returns a specific message for duplicate emails
          const msg = signUpError.message ?? "";
          if (msg.toLowerCase().includes("already registered") || msg.toLowerCase().includes("already exists")) {
            return Response.json(
              { error: "An account with that email already exists." },
              { status: 409 },
            );
          }
          return Response.json({ error: msg || "Sign-up failed." }, { status: 400 });
        }

        const userId = signUpData.user?.id;
        if (!userId) {
          return Response.json({ error: "Sign-up failed: no user ID returned." }, { status: 500 });
        }

        // Insert user_profiles row (FK to auth.users)
        const { error: profileError } = await admin
          .from("user_profiles")
          .insert({ id: userId, name });

        if (profileError) {
          console.error("Failed to create user_profiles row:", profileError);
          // Don't fail the whole signup — profile can be retried
        }

        // Also insert a minimal profiles row so FK constraints on memories/chat_messages work.
        // The id uses the uuid as text (profiles.id is text PRIMARY KEY).
        const { error: legacyProfileError } = await admin
          .from("profiles")
          .upsert({ id: userId, name, handle: email.split("@")[0] ?? name, accent: "emerald" });
        if (legacyProfileError) {
          console.error("Failed to upsert legacy profiles row:", legacyProfileError);
        }

        return Response.json({ userId, name }, { status: 201 });
      },
    },
  },
});
