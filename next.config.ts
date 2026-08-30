import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@vladmandic/human"],
  allowedDevOrigins: ["192.168.1.129", "192.168.1.129:3000", "*.loca.lt", "*.trycloudflare.com", "sponsors-but-exams-resident.trycloudflare.com"],
  experimental: {
    serverActions: {
      allowedOrigins: ["192.168.1.129:3000", "192.168.1.129", "*.loca.lt", "*.trycloudflare.com", "sponsors-but-exams-resident.trycloudflare.com"],
    },
  },
};

export default nextConfig;
