import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  outputFileTracingIncludes: {
    "/api/review": ["./fixtures/prs/**/*"],
  },
};

export default nextConfig;
