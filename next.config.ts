import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/api/generate-pdf": ["./fonts/**/*"],
  },
};

export default nextConfig;
