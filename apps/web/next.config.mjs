import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@adventure/core", "@adventure/db", "@adventure/agents"],
  experimental: {
    serverComponentsExternalPackages: ["@prisma/client", "prisma"],
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
