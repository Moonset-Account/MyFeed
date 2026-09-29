import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 避免把上级目录的 lockfile 误判为工作区根（home 目录存在 pnpm-lock.yaml）
  outputFileTracingRoot: path.join(__dirname),
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
