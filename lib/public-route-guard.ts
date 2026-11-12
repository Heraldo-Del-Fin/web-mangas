type Query = (sql: string, params: string[]) => Promise<Record<string, string>[]>;

function missingResource(head: boolean) {
  return new Response(head ? null : '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>Contenido no encontrado | KuruManga</title></head><body><main><h1>Contenido no encontrado</h1><a href="/biblioteca">Volver a la biblioteca</a></main></body></html>', {
    status: 404,
    headers: { "Content-Type": "text/html; charset=utf-8", "X-Robots-Tag": "noindex", "Cache-Control": "no-store" },
  });
}

export async function publicRouteGuard(request: Request, query: Query): Promise<Response | null> {
  const url = new URL(request.url);
  if (!["GET", "HEAD"].includes(request.method) || !/^\/(manga|leer)(\/|$)/.test(url.pathname)) return null;
  const head = request.method === "HEAD";
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length !== 2) return missingResource(head);
  let identifier: string;
  try { identifier = decodeURIComponent(parts[1]); } catch { return missingResource(head); }
  try {
    if (parts[0] === "manga") {
      const rows = await query(`SELECT slug FROM (
        SELECT slug, 0 AS priority FROM mangas WHERE slug=$1
        UNION ALL
        SELECT m.slug, 1 AS priority FROM manga_slug_redirects r JOIN mangas m ON m.id=r.manga_id WHERE r.old_slug=$1
      ) candidates ORDER BY priority LIMIT 1`, [identifier]);
      const target = rows[0]?.slug;
      if (!target) return missingResource(head);
      if (target !== identifier) {
        url.pathname = `/manga/${encodeURIComponent(target)}`;
        return Response.redirect(url, 301);
      }
    } else {
      const rows = await query(`SELECT cu.id FROM chapter_uploads cu
        JOIN mangas m ON m.id=cu.manga_id
        JOIN chapters c ON c.id=cu.chapter_id AND c.manga_id=m.id
        WHERE cu.id=$1 LIMIT 1`, [identifier]);
      if (!rows.length) return missingResource(head);
    }
    return null;
  } catch {
    // Never log database errors here: driver messages may contain credentials.
    console.error("No se pudo comprobar la ruta pública.");
    return new Response(head ? null : "Servicio temporalmente no disponible", {
      status: 503, headers: { "Retry-After": "60", "Cache-Control": "no-store" },
    });
  }
}
