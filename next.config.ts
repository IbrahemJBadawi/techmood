import type { NextConfig } from "next";

/**
 * Security headers on every response.
 *
 * - Nobody may show TechMood inside a frame on another site (clickjacking):
 *   X-Frame-Options for older browsers, frame-ancestors for current ones.
 * - Files are served as the type they say they are (no MIME sniffing).
 * - Links to other sites carry only our origin, never the full path.
 * - Camera, microphone and screen sharing are for TechMood's own session room
 *   (src/app/(app)/sessions/[sessionId]/Room.tsx) and nothing else; location
 *   and payment APIs are off.
 * - HTTPS is remembered for two years (Vercel serves HTTPS only anyway).
 *
 * A full Content-Security-Policy is deliberately not set yet: Next.js and the
 * theme bootstrap in src/app/layout.tsx use inline scripts, so a CSP needs
 * nonces — a change to make carefully, with the live site checked after.
 */
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(self), microphone=(self), display-capture=(self), geolocation=(), payment=(), usb=()",
  },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  // next/image only loads remote pictures from hosts listed here. Profile
  // photos live in Supabase Storage's public "avatars" bucket (the member card
  // and the public profile, src/app/u/[techmoodId]); localhost is the local
  // Supabase used in development.
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co", pathname: "/storage/v1/object/public/**" },
      { protocol: "http", hostname: "localhost", port: "54321", pathname: "/storage/v1/object/public/**" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" }, // Google sign-in photos
    ],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
