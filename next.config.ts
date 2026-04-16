import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdfkit", "pg", "@prisma/adapter-pg", "@anthropic-ai/sdk"],
};

export default nextConfig;
