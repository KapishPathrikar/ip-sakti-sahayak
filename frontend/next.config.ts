import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  // Allow Ngrok tunneling during development
  allowedDevOrigins: ['moneyless-hypertext-likely.ngrok-free.dev', 'localhost:3000'],
  async rewrites() {
    const backendUrl =
      process.env.NEXT_PUBLIC_BACKEND_URL ||
      process.env.NEXT_PUBLIC_API_BASE_URL ||
      "http://127.0.0.1:8000";

    return [
      {
        // Proxy to Backend, but exclude /api/chat/stream so our custom route handler can stream without buffering
        source: "/api/:path((?!chat/stream).*)",
        destination: `${backendUrl}/api/:path*`,
      },
      {
        // Proxy PDF corpus requests to backend static file mount
        source: "/corpus/:path*",
        destination: `${backendUrl}/corpus/:path*`,
      },
    ];
  },
};

export default nextConfig;
