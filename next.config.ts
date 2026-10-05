import type { NextConfig } from "next";

// Allows next/image to optimize (resize/re-encode/lazy-load) photos hosted
// in our own Supabase Storage bucket. Images pasted in as arbitrary URLs by
// users fall back to `unoptimized` in ImageCard instead of being allowlisted
// here, since we can't safely allowlist every possible external host.
const supabaseHostname = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : undefined;

const nextConfig: NextConfig = {
  images: {
    remotePatterns: supabaseHostname
      ? [
          {
            protocol: "https",
            hostname: supabaseHostname,
            pathname: "/storage/v1/object/public/**",
          },
        ]
      : [],
  },
};

export default nextConfig;
