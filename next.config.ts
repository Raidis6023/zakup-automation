import type { NextConfig } from "next";

// Public VED URLs are flat. Old bookmarks keep working through temporary
// redirects, without changing existing server-side page implementation.
const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: "/ved", destination: "/orders", permanent: false },
      { source: "/ved/commercial-offers", destination: "/commercial-offers", permanent: false },
      { source: "/ved/registry", destination: "/registry", permanent: false },
      { source: "/ved/registry/calculator", destination: "/registry/calculator", permanent: false },
      { source: "/ved/documents", destination: "/documents", permanent: false },
      { source: "/ved/references", destination: "/references", permanent: false },
      { source: "/ved-orders", destination: "/orders", permanent: false },
      { source: "/ved-orders/:id", destination: "/orders/:id", permanent: false },
    ];
  },
};

export default nextConfig;
