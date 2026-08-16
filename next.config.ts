import type { NextConfig } from 'next';

/**
 * The whole app runs client-side against a pluggable persistence layer
 * (see src/lib/db), so every route prerenders to static HTML either way.
 *
 * Default build: a standard Next.js output. This is the zero-configuration
 * path on Vercel and any other Next-aware host.
 *
 * `STATIC_EXPORT=1 npm run build`: a fully self-contained `out/` directory
 * that can be dropped on GitHub Pages, S3, or any plain file server.
 */
const staticExport = process.env.STATIC_EXPORT === '1';

const nextConfig: NextConfig = {
  ...(staticExport ? { output: 'export' as const, trailingSlash: true } : {}),
  images: { unoptimized: true },
  reactStrictMode: true,
};

export default nextConfig;
