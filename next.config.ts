import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

// Lets `next dev` reach Cloudflare bindings (D1, etc.) through a local proxy,
// so the same code path works in dev and once deployed to Workers.
initOpenNextCloudflareForDev();

const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;
