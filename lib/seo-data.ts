import { ensureNeonStoreTable, executeNeonQuery } from "./neon-db";

async function requireSchema() {
  if (!await ensureNeonStoreTable()) throw new Error("PostgreSQL no está disponible para consultar URLs.");
}

export async function mangaRouteTarget(slug: string): Promise<string | null> {
  await requireSchema();
  const result = await executeNeonQuery<{ slug: string }>(`
    SELECT slug FROM (
      SELECT slug, 0 AS priority FROM mangas WHERE slug=$1
      UNION ALL
      SELECT m.slug, 1 AS priority FROM manga_slug_redirects r JOIN mangas m ON m.id=r.manga_id WHERE r.old_slug=$1
    ) candidates ORDER BY priority LIMIT 1`, [slug]);
  if (!result.ok) throw new Error("No se pudo comprobar la URL de la obra.");
  return result.rows[0]?.slug ?? null;
}

export async function chapterRouteExists(id: string): Promise<boolean> {
  await requireSchema();
  const result = await executeNeonQuery(`SELECT cu.id FROM chapter_uploads cu
    JOIN mangas m ON m.id=cu.manga_id
    JOIN chapters c ON c.id=cu.chapter_id AND c.manga_id=m.id
    WHERE cu.id=$1 LIMIT 1`, [id]);
  if (!result.ok) throw new Error("No se pudo comprobar la URL del capítulo.");
  return result.rows.length > 0;
}

export interface SitemapSnapshot {
  mangas: { id: string; slug: string; createdAt: string; updatedAt?: string }[];
  uploads: { id: string; mangaId: string; createdAt: string; updatedAt?: string }[];
  groups: { slug: string; updatedAt?: string }[];
}

export async function sitemapSnapshot(): Promise<SitemapSnapshot> {
  await requireSchema();
  const result = await executeNeonQuery<{ data: SitemapSnapshot }>(`
    SELECT json_build_object(
      'mangas', COALESCE((SELECT json_agg(x) FROM (SELECT id,slug,created_at AS "createdAt",updated_at AS "updatedAt" FROM mangas) x),'[]'::json),
      'uploads', COALESCE((SELECT json_agg(x) FROM (
        SELECT cu.id,cu.manga_id AS "mangaId",cu.created_at AS "createdAt",cu.updated_at AS "updatedAt"
        FROM chapter_uploads cu JOIN mangas m ON m.id=cu.manga_id
        JOIN chapters c ON c.id=cu.chapter_id AND c.manga_id=m.id
      ) x),'[]'::json),
      'groups', COALESCE((SELECT json_agg(x) FROM (SELECT slug,updated_at AS "updatedAt" FROM scanlations) x),'[]'::json)
    ) AS data`);
  if (!result.ok || !result.rows[0]?.data) throw new Error("No se pudo generar el sitemap; no se publicará un catálogo vacío.");
  return result.rows[0].data;
}
