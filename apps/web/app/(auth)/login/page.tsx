"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { Button, Card, Input } from "@/components/ui";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const next = useSearchParams().get("next") ?? "/dashboard";

  const redirectTo = () =>
    `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

  async function sendMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabaseBrowser().auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo() },
    });
    setLoading(false);
    if (error) setError(error.message);
    else setSent(true);
  }

  async function signInWithGoogle() {
    setError(null);
    const { error } = await supabaseBrowser().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: redirectTo() },
    });
    if (error) setError(error.message);
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <Card className="w-full max-w-md">
        <h1 className="text-2xl font-bold">
          Adventure <span className="text-brand-500">AI</span>
        </h1>
        <p className="mt-2 text-sm text-ink-400">
          Sign in or create an account — free, no card required.
        </p>

        {sent ? (
          <p className="mt-6 rounded-lg bg-emerald-500/10 p-4 text-sm text-emerald-400">
            Magic link sent to <strong>{email}</strong>. Check your inbox.
          </p>
        ) : (
          <>
            <form onSubmit={sendMagicLink} className="mt-6 space-y-3">
              <Input
                type="email"
                required
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <Button className="w-full" disabled={loading}>
                {loading ? "Sending…" : "Send magic link"}
              </Button>
            </form>
            <div className="my-4 flex items-center gap-3 text-xs text-ink-400">
              <div className="h-px flex-1 bg-ink-800" /> or <div className="h-px flex-1 bg-ink-800" />
            </div>
            <Button variant="outline" className="w-full" onClick={signInWithGoogle}>
              Continue with Google
            </Button>
          </>
        )}
        {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
      </Card>
    </main>
  );
}
