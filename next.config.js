/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['lh3.googleusercontent.com', 'firebasestorage.googleapis.com'],
  },
  experimental: {
    // Remove appDir as it's no longer needed in Next.js 13+
  },
  // Remove swcMinify as it's now enabled by default
}

module.exports = nextConfig 