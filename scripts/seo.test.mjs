import { test } from "node:test";
import assert from "node:assert/strict";
import { aggregateRating, buildSitemap, knownLastModified } from "../lib/seo.ts";

test("no publica valoraciones sin votos o fuera de rango", () => {
  for (const value of [{ rating: 0, votesCount: 0 }, { rating: 5, votesCount: 0 }, { rating: NaN, votesCount: 1 }, { rating: 6, votesCount: 2 }]) assert.equal(aggregateRating(value), undefined);
  assert.equal(aggregateRating({ rating: 3.5, votesCount: 2 }).ratingCount, 2);
});
test("lastmod usa el último cambio conocido y omite fechas desconocidas", () => {
  assert.equal(knownLastModified(undefined, null, "invalid"), undefined);
  assert.equal(knownLastModified("2025-01-01", "2026-01-02", "2024-01-01").toISOString(), "2026-01-02T00:00:00.000Z");
});
test("el sitemap usa URLs canónicas y fechas del contenido, nunca la hora de generación", () => {
  const snapshot = {
    mangas: [{ id: "m", slug: "slug-actual", createdAt: "2020-01-01", updatedAt: "2021-01-01" }],
    uploads: [{ id: "up", mangaId: "m", createdAt: "2022-01-01", updatedAt: "2023-01-01" }],
    groups: [{ slug: "grupo-sin-fecha" }],
  };
  const result = buildSitemap(snapshot, "https://example.invalid");
  assert.equal(result.find((r) => r.url.endsWith("/manga/slug-actual")).lastModified.toISOString(), "2023-01-01T00:00:00.000Z");
  assert.equal(result.find((r) => r.url.endsWith("/leer/up")).lastModified.toISOString(), "2023-01-01T00:00:00.000Z");
  assert.equal(result[0].lastModified, undefined);
  assert.equal(result.find((r) => r.url.endsWith("/grupos/grupo-sin-fecha")).lastModified, undefined);
  assert.deepEqual(buildSitemap(snapshot, "https://example.invalid"), result);
});
