import type { NextConfig } from "next";

// cool-nwc is ESM-only with no native code, so Next 15 bundles it for the server
// with no special handling. See docs/DEPLOYMENT.md §3 — do not add
// `serverExternalPackages` pre-emptively.
const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Isolated compile cache when NEXT_DIST_DIR is set. Default remains .next.
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
