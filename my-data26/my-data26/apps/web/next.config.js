/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@daylaixe/shared'],
  images: {
    remotePatterns: [{ protocol: 'https', hostname: '**.supabase.co' }],
  },
};
module.exports = nextConfig;
