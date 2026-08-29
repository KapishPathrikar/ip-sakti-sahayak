import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: {
    appIsrStatus: false,
    buildActivity: false,
  },
  // Allow Ngrok tunneling during development
  allowedDevOrigins: ['moneyless-hypertext-likely.ngrok-free.dev', 'localhost:3000'],
  async rewrites() {
    return [
      {
        // Proxy to Backend, but exclude /api/chat/stream so our custom route handler can stream without buffering
        source: "/api/:path((?!chat/stream).*)",
        destination: "http://127.0.0.1:8000/api/:path*",
      },
    ];
  },
};

export default nextConfig;
