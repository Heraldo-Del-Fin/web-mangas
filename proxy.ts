import { NextRequest, NextResponse } from "next/server";
import { chapterRouteExists, mangaRouteTarget } from "@/lib/seo-data";

function missingResource() {
  return new NextResponse('<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Contenido no encontrado | KuruManga</title></head><body><main><h1>Contenido no encontrado</h1><p>La obra o el capítulo solicitado no existe.</p><a href="/biblioteca">Volver a la biblioteca</a></main></body></html>', {
    status: 404, headers: { "Content-Type": "text/html; charset=utf-8", "X-Robots-Tag": "noindex", "Cache-Control": "no-store" },
  });
}

// Resolve existence/redirects before any streamed layout can commit HTTP 200.
export async function proxy(request: NextRequest) {
  if (!["GET", "HEAD"].includes(request.method)) return NextResponse.next();
  const parts = request.nextUrl.pathname.split("/").filter(Boolean);
  if (parts.length !== 2) return missingResource();
  let identifier: string;
  try { identifier = decodeURIComponent(parts[1]); } catch { return missingResource(); }
  try {
    if (parts[0] === "manga") {
      const target = await mangaRouteTarget(identifier);
      if (!target) return missingResource();
      if (target !== identifier) {
        const destination = request.nextUrl.clone();
        destination.pathname = `/manga/${encodeURIComponent(target)}`;
        return NextResponse.redirect(destination, 301);
      }
    } else if (!await chapterRouteExists(identifier)) return missingResource();
    return NextResponse.next();
  } catch (error) {
    console.error("No se pudo resolver la ruta pública:", error instanceof Error ? error.message : "Error");
    return new NextResponse("Servicio temporalmente no disponible", {
      status: 503, headers: { "Retry-After": "60", "Cache-Control": "no-store" },
    });
  }
}

export const config = { matcher: ["/manga/:path*", "/leer/:path*"] };
