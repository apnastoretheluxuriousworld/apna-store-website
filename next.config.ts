import type { NextConfig } from "next";

// Media served from the bucket's public URL (R2 r2.dev or a custom domain).
function mediaPatterns() {
  const patterns: { protocol: "https"; hostname: string }[] = [
    { protocol: "https", hostname: "**.r2.dev" },
  ];
  try {
    const host = new URL(process.env.S3_PUBLIC_URL ?? "").hostname;
    if (host && !host.endsWith(".r2.dev")) patterns.push({ protocol: "https", hostname: host });
  } catch {
    /* not set yet */
  }
  return patterns;
}

const nextConfig: NextConfig = {
  images: {
    remotePatterns: mediaPatterns(),
    formats: ["image/avif", "image/webp"],
  },
  // Dev only: let phones on the same Wi-Fi load the dev server by LAN IP
  // (e.g. http://10.20.210.140:3000). Without this Next blocks dev scripts,
  // the page never hydrates, and animated content stays invisible.
  allowedDevOrigins: ["10.*.*.*", "192.168.*.*", "172.*.*.*", "*.local"],
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
