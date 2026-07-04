/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@adventure/core", "@adventure/db", "@adventure/agents"],
  experimental: {
    serverComponentsExternalPackages: ["@prisma/client"],
  },
};

export default nextConfig;
