import type { NextConfig } from "next";

/** @type {import('next').NextConfig} */
const nextConfig: NextConfig = {
  /* config options here */
  serverExternalPackages: ["unpdf"],
  async redirects() {
    return [{ source: "/meets", destination: "/events", permanent: false }];
  },
  images: {
    domains: ['i.imgur.com', 'imgur.com', 'www.primeswimacademy.com', 'primeswimacademy.com'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'i.imgur.com',
      },
      {
        protocol: 'https',
        hostname: 'imgur.com',
      },
      {
        protocol: 'https',
        hostname: 'www.primeswimacademy.com',
      },
      {
        protocol: 'https',
        hostname: 'primeswimacademy.com',
      },
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
      },
    ],
  },
};

export default nextConfig;
