import type { NextConfig } from "next";

const extraDevOrigins =
  process.env.NEXT_ALLOWED_DEV_ORIGINS?.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean) ?? [];

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "192.168.1.111",
    "100.93.119.73",
    "humourlessly-combative-pura.ngrok-free.dev",
    "*.ngrok-free.dev",
    "*.ngrok-free.app",
    "*.ngrok.app",
    "*.ngrok.io",
    ...extraDevOrigins,
  ],
};

export default nextConfig;
