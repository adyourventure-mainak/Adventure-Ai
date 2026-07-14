import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Content-Security-Policy for the dashboard/marketing app. Scripts are limited
// to our own origin plus Razorpay's checkout; everything external that the app
// legitimately uses (Supabase auth/storage, Razorpay checkout frame) is
// enumerated. 'unsafe-inline' remains on script-src because Next's App Router
// injects inline bootstrap scripts without a nonce — a nonce-based CSP is the
// recommended follow-up hardening.
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://checkout.razorpay.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.supabase.co",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.razorpay.com",
  "frame-src 'self' https://*.razorpay.com",
  "form-action 'self' https://*.razorpay.com",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains; preload",
  },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@adventure/core", "@adventure/db", "@adventure/agents"],
  async headers() {
    // Applied to every response. These headers don't affect the CORS behaviour
    // of the public lead API (which sets its own Access-Control-* headers).
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  experimental: {
    instrumentationHook: true,
    serverComponentsExternalPackages: ["@prisma/client", "prisma", "sharp"],
    // Monorepo: trace server dependencies from the workspace root so the pnpm
    // virtual store is reachable.
    outputFileTracingRoot: path.join(__dirname, "../.."),
    // Next's tracer misses Prisma's native query engine (.so.node) inside the
    // pnpm store on Vercel — force-include it in every serverless function.
    outputFileTracingIncludes: {
      "*": [
        // Covered from both plausible glob bases (project dir vs tracing root).
        "node_modules/.pnpm/@prisma+client*/node_modules/.prisma/client/*.so.node",
        "../../node_modules/.pnpm/@prisma+client*/node_modules/.prisma/client/*.so.node",
      ],
    },
  },
};

export default nextConfig;
