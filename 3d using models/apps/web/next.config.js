/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['s3.example.com'],
  },
}

module.exports = nextConfig;
