import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const schema = z.object({
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

type FormData = z.infer<typeof schema>;

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in — Déjà Dev" },
      { name: "description", content: "Sign in to your Déjà Dev accountability coach account." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
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
      const { error } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });
      if (error) {
        setServerError(
          error.message.toLowerCase().includes("invalid login credentials")
            ? "Incorrect email or password."
            : error.message,
        );
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
          <h1 className="font-mono text-sm text-foreground">Sign in</h1>

          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="login-email" className="mono-label">
                Email
              </label>
              <input
                id="login-email"
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
              <label htmlFor="login-password" className="mono-label">
                Password
              </label>
              <input
                id="login-password"
                type="password"
                autoComplete="current-password"
                {...register("password")}
                className="w-full rounded-md border border-hairline bg-surface-raised px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-signal"
                placeholder="••••••••"
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
              id="login-submit"
              disabled={loading}
              className="w-full rounded-md bg-signal px-4 py-2 font-mono text-xs text-signal-foreground transition-opacity disabled:opacity-50"
            >
              {loading ? "signing in…" : "Sign in"}
            </button>
          </form>

          <div className="border-t border-hairline pt-4 text-center text-xs text-muted-foreground">
            No account?{" "}
            <Link to="/signup" className="text-signal hover:underline">
              Create one
            </Link>
          </div>
        </div>

        {/* Demo entry point */}
        <div className="panel p-4 text-center">
          <p className="text-xs text-muted-foreground">
            Evaluating for the hackathon?{" "}
          </p>
          <Link
            to="/"
            search={{ demo: "true" }}
            id="try-demo-link"
            className="mt-1 inline-flex items-center gap-1.5 rounded-md border border-hairline px-3 py-1.5 font-mono text-[11px] text-muted-foreground transition-colors hover:border-signal hover:text-signal"
          >
            <span className="size-1.5 rounded-full bg-warn" />
            Try the demo (Alex / Ada / Tunde)
          </Link>
        </div>
      </div>
    </div>
  );
}
