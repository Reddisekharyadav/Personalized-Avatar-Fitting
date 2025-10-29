/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['media.sketchfab.com', 'static.readyplayer.me'],
  },
};

module.exports = nextConfig;
