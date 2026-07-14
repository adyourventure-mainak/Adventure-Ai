/**
 * Runs once at server startup (Next.js instrumentation hook). Fails fast if a
 * critical environment variable is missing, so the app refuses to boot in a
 * misconfigured state rather than erroring deep in a request.
 *
 * Only "critical" vars are fatal — ones the app cannot function without.
 * Feature-gated integrations (Razorpay, Resend, GitHub/Vercel provisioning)
 * degrade gracefully and are intentionally not listed here.
 */
export function register() {
  // Node runtime only — skip the Edge runtime (middleware), which can't read
  // server secrets anyway.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const missing: string[] = [];
  const need = (name: string, present: boolean) => {
    if (!present) missing.push(name);
  };

  need("DATABASE_URL", !!process.env.DATABASE_URL);
  need("NEXT_PUBLIC_SUPABASE_URL", !!process.env.NEXT_PUBLIC_SUPABASE_URL);
  need(
    "NEXT_PUBLIC_SUPABASE_ANON_KEY (or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)",
    !!(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY),
  );
  need("SUPABASE_SERVICE_ROLE_KEY", !!process.env.SUPABASE_SERVICE_ROLE_KEY);
  need("OPENAI_API_KEY", !!process.env.OPENAI_API_KEY);

  if (missing.length > 0) {
    throw new Error(
      `[env] Refusing to start — missing required environment variable(s): ${missing.join(", ")}. ` +
        `Set them in the deployment environment (see .env.example).`,
    );
  }
}
