import { fileURLToPath } from "node:url";
import path from "node:path";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // 锁定工作区根目录，避免误识别到上级目录的 lockfile
  outputFileTracingRoot: projectRoot,
};

export default nextConfig;
