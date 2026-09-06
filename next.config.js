/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: __dirname,
  // A production build must not overwrite a running development server's chunks.
  distDir: process.env.NODE_ENV === 'development' ? '.next-dev' : '.next',
  images: {
    unoptimized: true,
  },
}

module.exports = nextConfig
