import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cache Components = Next 16's PPR model. Unlocks `use cache` / `cacheLife` /
  // `cacheTag` and lets `app/page.tsx` ship a static shell while the product
  // grid streams. See DECISIONS.md.
  cacheComponents: true,

  images: {
    // Product hero shots live on the Vercel files blob store. Square art,
    // varying pixel sizes — next/image normalises + optimises them.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "vercelfiles.blob.core.windows.net",
        pathname: "/vercelproductfiles/**",
      },
    ],
    formats: ["image/avif", "image/webp"],
    // Optimised derivatives are cached on Vercel's image CDN. The catalog art
    // changes rarely, so hold them for 30 days.
    minimumCacheTTL: 2_592_000,
  },
};

export default nextConfig;
