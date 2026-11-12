import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
import path from "node:path";

const nextConfig: NextConfig = {
  // Bundling pg avoids OpenNext recreating Turbopack's external-package
  // symlink on Windows, where that operation can require extra privileges.
  ...(process.env.APP_ENV === "local-test" ? { transpilePackages: ["pg"] } : {}),
  async headers() {
    return ["staging", "local-test"].includes(process.env.APP_ENV ?? "")
      ? [{ source: "/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" }] }]
      : [];
  },
  experimental: {
    ...(process.env.APP_ENV === "local-test" ? { cpus: 1 } : {}),
    serverActions: {
      // Las páginas de capítulos ya se suben por /api/upload-page;
      // este límite solo afecta a la portada al crear una obra.
      bodySizeLimit: "10mb",
    },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default async function configureNext(): Promise<NextConfig> {
  if (process.env.APP_ENV === "local-test" && process.env.NODE_ENV !== "production") {
    await initOpenNextCloudflareForDev({
      configPath: path.resolve("config/local/wrangler.json"),
      persist: { path: path.resolve(".wrangler/local-test") },
    });
  }
  return nextConfig;
}
