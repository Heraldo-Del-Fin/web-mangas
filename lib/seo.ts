import type { Manga } from "./types";
import type { MetadataRoute } from "next";
import type { SitemapSnapshot } from "./seo-data";

export function aggregateRating(manga: Pick<Manga, "rating" | "votesCount">) {
  if (!Number.isInteger(manga.votesCount) || manga.votesCount <= 0 || !Number.isFinite(manga.rating) || manga.rating < 1 || manga.rating > 5) return undefined;
  return { "@type": "AggregateRating", ratingValue: manga.rating.toFixed(2), bestRating: "5", worstRating: "1", ratingCount: manga.votesCount };
}

export function knownLastModified(...values: (string | null | undefined)[]): Date | undefined {
  const dates = values.filter((value): value is string => Boolean(value)).map((value) => Date.parse(value)).filter(Number.isFinite);
  return dates.length ? new Date(Math.max(...dates)) : undefined;
}

export function buildSitemap({ mangas, uploads, groups }: SitemapSnapshot, siteUrl: string): MetadataRoute.Sitemap {
  const mangaDates = new Map<string, string[]>();
  for (const upload of uploads) {
    const dates = mangaDates.get(upload.mangaId) ?? [];
    dates.push(upload.updatedAt ?? upload.createdAt);
    mangaDates.set(upload.mangaId, dates);
  }
  return [
    ...["/", "/biblioteca", "/grupos"].map((route) => ({ url: `${siteUrl}${route}` })),
    ...mangas.map((manga) => ({
      url: `${siteUrl}/manga/${encodeURIComponent(manga.slug)}`,
      lastModified: knownLastModified(manga.createdAt, manga.updatedAt, ...(mangaDates.get(manga.id) ?? [])),
    })),
    ...uploads.map((upload) => ({
      url: `${siteUrl}/leer/${encodeURIComponent(upload.id)}`,
      lastModified: knownLastModified(upload.createdAt, upload.updatedAt),
    })),
    ...groups.map((group) => ({
      url: `${siteUrl}/grupos/${encodeURIComponent(group.slug)}`,
      lastModified: knownLastModified(group.updatedAt),
    })),
  ];
}
