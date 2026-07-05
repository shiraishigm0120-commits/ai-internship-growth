import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // Security headers (applied in middleware or vercel.json for deployment)
  poweredByHeader: false,

  // Allow images from auth providers
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
    ],
  },
}

export default nextConfig
