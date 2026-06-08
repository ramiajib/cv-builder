/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    // Pre-existing type errors in older pages don't block the production build.
    // Run `npm run type-check` locally to review them.
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
    ],
  },
};

module.exports = nextConfig;
