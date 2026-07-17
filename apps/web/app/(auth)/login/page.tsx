"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
  const [oauthStarted, setOauthStarted] = useState(false);
  const router = useRouter();
  const next = useSearchParams().get("next") ?? "/dashboard";

  // Already signed in? Straight to the app. This also rescues replayed OAuth
  // flows (flow_state_already_used): the first pass logged the user in, the
  // stale retry errored — but the session exists, so there's nothing to fix.
  useEffect(() => {
    supabaseBrowser()
      .auth.getSession()
      .then(({ data }) => {
        if (data.session) router.replace(next);
      })
      .catch(() => {});
  }, [next, router]);

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
    // Double-clicking starts two OAuth flows; the second invalidates the
    // first's state at Supabase → "flow_state_already_used". Start one only.
    if (oauthStarted) return;
    setOauthStarted(true);
    setError(null);
    const { error } = await supabaseBrowser().auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: redirectTo(),
        // Always show Google's account chooser instead of silently reusing
        // the last-used profile.
        queryParams: { prompt: "select_account" },
      },
    });
    if (error) {
      setError(error.message);
      setOauthStarted(false);
    }
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
            <Button variant="outline" className="w-full" disabled={oauthStarted} onClick={signInWithGoogle}>
              {oauthStarted ? "Redirecting to Google…" : "Continue with Google"}
            </Button>
          </>
        )}
        {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
      </Card>
    </main>
  );
}
