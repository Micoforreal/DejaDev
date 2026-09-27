import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const schema = z.object({
  name: z.string().min(2, "Display name must be at least 2 characters.").max(40),
  email: z.string().email("Enter a valid email address."),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters.")
    .max(72, "Password too long."),
});

type FormData = z.infer<typeof schema>;

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { title: "Create account — Déjà Dev" },
      { name: "description", content: "Create your Déjà Dev accountability coach account." },
    ],
  }),
  component: SignupPage,
});

function SignupPage() {
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    setServerError(null);
    setLoading(true);
    try {
      // Create the user via our server route (which also creates profiles rows)
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: data.email, password: data.password, name: data.name }),
      });
      const json = (await res.json()) as { error?: string; userId?: string };
      if (!res.ok) {
        setServerError(json.error ?? "Sign-up failed.");
        return;
      }

      // Sign in immediately with the new credentials
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });
      if (signInError) {
        setServerError("Account created — please sign in.");
        await navigate({ to: "/login" });
        return;
      }

      await navigate({ to: "/" });
    } catch {
      setServerError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        {/* Logo */}
        <div className="space-y-1 text-center">
          <p className="font-mono text-lg font-semibold tracking-tight text-foreground">
            déjà<span className="text-signal">·</span>dev
          </p>
          <p className="text-xs text-muted-foreground">Yesterday remembers what you shipped.</p>
        </div>

        {/* Card */}
        <div className="panel space-y-5 p-6">
          <div>
            <h1 className="font-mono text-sm text-foreground">Create account</h1>
            <p className="mt-1 text-xs text-muted-foreground">
              Your memories are private and persistent across sessions.
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="signup-name" className="mono-label">
                Display name
              </label>
              <input
                id="signup-name"
                type="text"
                autoComplete="name"
                {...register("name")}
                className="w-full rounded-md border border-hairline bg-surface-raised px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-signal"
                placeholder="Your name"
              />
              {errors.name && (
                <p className="text-[11px] text-blocker">{errors.name.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="signup-email" className="mono-label">
                Email
              </label>
              <input
                id="signup-email"
                type="email"
                autoComplete="email"
                {...register("email")}
                className="w-full rounded-md border border-hairline bg-surface-raised px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-signal"
                placeholder="you@example.com"
              />
              {errors.email && (
                <p className="text-[11px] text-blocker">{errors.email.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="signup-password" className="mono-label">
                Password
              </label>
              <input
                id="signup-password"
                type="password"
                autoComplete="new-password"
                {...register("password")}
                className="w-full rounded-md border border-hairline bg-surface-raised px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-signal"
                placeholder="min. 8 characters"
              />
              {errors.password && (
                <p className="text-[11px] text-blocker">{errors.password.message}</p>
              )}
            </div>

            {serverError && (
              <p className="rounded-md border border-blocker/30 bg-blocker/5 px-3 py-2 text-xs text-blocker">
                {serverError}
              </p>
            )}

            <button
              type="submit"
              id="signup-submit"
              disabled={loading}
              className="w-full rounded-md bg-signal px-4 py-2 font-mono text-xs text-signal-foreground transition-opacity disabled:opacity-50"
            >
              {loading ? "creating account…" : "Create account"}
            </button>
          </form>

          <div className="border-t border-hairline pt-4 text-center text-xs text-muted-foreground">
            Already have an account?{" "}
            <Link to="/login" className="text-signal hover:underline">
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
