import type { MetadataRoute } from "next";
import { isTestEnvironment } from "@/lib/runtime-environment";
import { sitemapSnapshot } from "@/lib/seo-data";
import { buildSitemap } from "@/lib/seo";

export const dynamic = "force-dynamic";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "https://kurumanga.dheraldo.workers.dev";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (isTestEnvironment()) return [];
  return buildSitemap(await sitemapSnapshot(), SITE_URL);
}
