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
  /**
   * The assistant's model route lives in `route.api.ts`, and `api.ts` counts
   * as a page extension only outside the static export.
   *
   * A route handler cannot be statically exported, so its mere presence would
   * fail `build:static`. Naming it this way means the static build does not
   * see it as a route at all: `out/` stays a pure file-server bundle, and the
   * app there falls back to the built-in deterministic assistant.
   */
  pageExtensions: staticExport ? ['tsx', 'ts'] : ['tsx', 'ts', 'api.ts'],
  images: { unoptimized: true },
  reactStrictMode: true,
};

export default nextConfig;
