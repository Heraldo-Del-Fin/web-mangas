import { MetadataRoute } from "next";
import { isTestEnvironment } from "@/lib/runtime-environment";
import { getAllMangas, getScanlationGroups } from "@/lib/data";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
  "https://kurumanga.dheraldo.workers.dev";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (isTestEnvironment()) return [];
  const [mangas, scanlations] = await Promise.all([
    getAllMangas().catch(() => []),
    getScanlationGroups().catch(() => []),
  ]);

  const now = new Date();

  // 1. Páginas principales públicas
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: `${SITE_URL}/`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 1.0,
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

  // 2. Fichas de Manga, Manhwa, Manhua
  const mangaRoutes: MetadataRoute.Sitemap = mangas.map((manga) => ({
    url: `${SITE_URL}/manga/${encodeURIComponent(manga.slug)}`,
    lastModified: manga.createdAt ? new Date(manga.createdAt) : now,
    changeFrequency: "weekly",
    priority: 0.85,
  }));

  // 3. Capítulos individuales para lectura
  const chapterRoutes: MetadataRoute.Sitemap = [];
  for (const manga of mangas) {
    for (const chapter of manga.chapters ?? []) {
      for (const upload of chapter.uploads ?? []) {
        chapterRoutes.push({
          url: `${SITE_URL}/leer/${encodeURIComponent(upload.id)}`,
          lastModified: upload.createdAt ? new Date(upload.createdAt) : now,
          changeFrequency: "monthly",
          priority: 0.7,
        });
      }
    }
  }

  // 4. Perfiles de grupos Scanlation
  const scanlationRoutes: MetadataRoute.Sitemap = scanlations.map((scan) => ({
    url: `${SITE_URL}/grupos/${encodeURIComponent(scan.slug)}`,
    lastModified: now,
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  return [
    ...staticRoutes,
    ...mangaRoutes,
    ...chapterRoutes,
    ...scanlationRoutes,
  ];
}

