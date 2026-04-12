import type { NextConfig } from "next";

const extraDevOrigins =
  process.env.NEXT_ALLOWED_DEV_ORIGINS?.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean) ?? [];

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.1.111", ...extraDevOrigins],
};

export default nextConfig;
