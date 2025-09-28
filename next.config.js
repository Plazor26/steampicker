// next.config.mjs
/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      // Avatars
      { protocol: 'https', hostname: 'avatars.steamstatic.com' },
      // App headers & store assets (both old/new CDNs)
      { protocol: 'https', hostname: 'cdn.akamai.steamstatic.com' },
      { protocol: 'https', hostname: 'shared.cloudflare.steamstatic.com' },
      { protocol: 'https', hostname: 'steamcdn-a.akamaihd.net' },
      // User-uploaded images/screenshots (sometimes referenced)
      { protocol: 'https', hostname: 'steamuserimages-a.akamaihd.net' },
      // Legacy media paths (rare, but safe to allow)
      { protocol: 'https', hostname: 'media.steampowered.com' },
    ],
  },
};

export default nextConfig;
