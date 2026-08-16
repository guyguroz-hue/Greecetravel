import type { NextConfig } from 'next';

/**
 * The whole app runs client-side against a pluggable persistence layer
 * (see src/lib/db), so it can be exported as a fully static bundle and
 * hosted anywhere — Vercel, Netlify, GitHub Pages, or an S3 bucket.
 */
const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
};

export default nextConfig;
