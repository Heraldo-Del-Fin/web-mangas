
import { MetadataRoute } from "next";
import { getAllMangas, getScanlationGroups } from "@/lib/data";

const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ||
  "https://kurumanga.dheraldo.workers.dev"
).replace(/\/$/, "");

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [mangas, scanlations] = await Promise.all([
    getAllMangas(),
    getScanlationGroups(),
  ]);

  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: `${SITE_URL}/`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${SITE_URL}/biblioteca`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/grupos`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
    },
  ];

  const mangaRoutes: MetadataRoute.Sitemap = mangas.map((manga) => ({
    url: `${SITE_URL}/manga/${encodeURIComponent(manga.slug)}`,
    lastModified: manga.createdAt
      ? new Date(manga.createdAt)
      : now,
    changeFrequency: "weekly",
    priority: 0.85,
  }));

  const scanlationRoutes: MetadataRoute.Sitemap =
    scanlations.map((scan) => ({
      url: `${SITE_URL}/grupos/${encodeURIComponent(scan.slug)}`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.6,
    }));

  return [
    ...staticRoutes,
    ...mangaRoutes,
    ...scanlationRoutes,
  ];
}


