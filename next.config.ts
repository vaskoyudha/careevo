import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "d3njjcbhbojbot.cloudfront.net",
      },
      {
        protocol: "https",
        hostname: "d2j5ihb19pt1hq.cloudfront.net",
      },
      {
        protocol: "https",
        hostname: "images.ctfassets.net",
      },
      {
        protocol: "https",
        hostname: "d15cw65ipctsrr.cloudfront.net",
      },
      {
        protocol: "https",
        hostname: "coursera-course-photos.s3.amazonaws.com",
      },
      {
        protocol: "https",
        hostname: "coursera-university-assets.s3.amazonaws.com",
      },
      {
        protocol: "http",
        hostname: "coursera-university-assets.s3.amazonaws.com",
      },
    ],
  },
};

export default nextConfig;
