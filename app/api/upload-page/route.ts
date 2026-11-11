import { NextResponse } from "next/server";
import { getUploadPermission } from "@/lib/auth";
import { uploadMangaImage } from "@/lib/r2-storage";

const MAX_PAGE_BYTES = 20 * 1024 * 1024; // 20 MB por página

/**
 * Sube UNA sola página de capítulo a Cloudflare R2.
 * El navegador llama a este endpoint varias veces en paralelo (una por imagen),
 * lo que permite subir más rápido y mostrar el progreso real de cada página.
 */
export async function POST(request: Request) {
  const permission = await getUploadPermission();
  if (!permission) {
    return NextResponse.json(
      { ok: false, error: "No tienes permisos para subir páginas." },
      { status: 403 }
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Solicitud inválida." },
      { status: 400 }
    );
  }

  const file = formData.get("file");
  const mangaSlug = String(formData.get("mangaSlug") || "")
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "")
    .slice(0, 120);
  const chapterNumber = String(formData.get("chapterNumber") || "")
    .replace(/[^0-9.]/g, "")
    .slice(0, 12);
  const pageIndex = Number(formData.get("pageIndex"));

  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json(
      { ok: false, error: "No se recibió ninguna imagen." },
      { status: 400 }
    );
  }
  if (!file.type.startsWith("image/")) {
    return NextResponse.json(
      { ok: false, error: "El archivo debe ser una imagen." },
      { status: 415 }
    );
  }
  if (file.size > MAX_PAGE_BYTES) {
    return NextResponse.json(
      { ok: false, error: "La imagen supera el límite de 20 MB." },
      { status: 413 }
    );
  }
  if (!mangaSlug || !chapterNumber || Number.isNaN(pageIndex)) {
    return NextResponse.json(
      { ok: false, error: "Faltan datos de obra, capítulo o número de página." },
      { status: 400 }
    );
  }

  const pageName = String(pageIndex + 1).padStart(3, "0");
  const url = await uploadMangaImage(
    file,
    `chapters/${mangaSlug}/cap-${chapterNumber}`,
    pageName
  );

  if (!url) {
    return NextResponse.json(
      { ok: false, error: "No se pudo guardar la imagen en R2." },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true, url, pageIndex });
}

