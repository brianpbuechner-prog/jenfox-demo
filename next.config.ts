import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // /brief reads content/brief.html at build time; make sure the file ships with it.
  outputFileTracingIncludes: { "/brief": ["./content/brief.html"], "/": ["./content/brief.html"] },
  // Sign app demo: static pages in public/signs. A volunteer link /signs/r/<token> opens the route page.
  async rewrites() {
    return [
      { source: "/signs", destination: "/signs/index.html" },
      { source: "/signs/", destination: "/signs/index.html" },
      { source: "/signs/r/:token", destination: "/signs/route.html" },
      { source: "/signs/delivery/r/:token", destination: "/signs/delivery/route.html" },
    ];
  },
};

export default nextConfig;
