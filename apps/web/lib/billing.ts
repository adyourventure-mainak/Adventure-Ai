/**
 * Payment bypass for local/preview testing only: BILLING_TEST_MODE=1 grants
 * trials, subscriptions and credit packs without a Razorpay charge.
 *
 * The live deployment must never honour it, even if the env var gets set there
 * by mistake — so production is hard-gated here rather than trusted to config.
 * VERCEL_ENV is "production" only on the live deployment ("preview" for preview
 * builds), unlike NODE_ENV which is "production" for both.
 */
export function billingTestMode(): boolean {
  if (process.env.VERCEL_ENV === "production") return false;
  return process.env.BILLING_TEST_MODE === "1";
}
