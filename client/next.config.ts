import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Proxy all API calls through the Next.js origin so the refresh-token cookie is
  // first-party in every browser (a cross-site cookie between *.vercel.app and
  // *.railway.app is rejected regardless of SameSite — Safari blocks third-party
  // cookies entirely). The browser only ever talks to this origin; Vercel's server
  // forwards to the Express API.
  //
  // Production: set API_PROXY_URL (server-side env, NOT NEXT_PUBLIC_*) to the API URL.
  // Development: defaults to the local Express server.
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${process.env.API_PROXY_URL ?? "http://localhost:4000"}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
