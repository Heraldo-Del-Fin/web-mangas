export type PageUploadStatus = "pending" | "uploading" | "done" | "error";

export interface PageUploadState {
  name: string;
  size: number;
  loaded: number;
  status: PageUploadStatus;
  url?: string;
  error?: string;
}

interface UploadPagesOptions {
  files: File[];
  mangaSlug: string;
  chapterNumber: string;
  concurrency?: number;
  maxRetries?: number;
  onUpdate: (pages: PageUploadState[], speedBytesPerSec: number) => void;
}

function uploadSinglePage(
  file: File,
  fields: Record<string, string>,
  onProgress: (loaded: number) => void
): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const body = new FormData();
    body.append("file", file);
    for (const [k, v] of Object.entries(fields)) body.append(k, v);

    xhr.open("POST", "/api/upload-page");
    xhr.responseType = "json";

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.min(e.loaded, file.size));
    };

    xhr.onload = () => {
      const data = xhr.response as { ok?: boolean; url?: string; error?: string } | null;
      if (xhr.status >= 200 && xhr.status < 300 && data?.ok && data.url) {
        resolve(data.url);
      } else {
        reject(new Error(data?.error || `Error HTTP ${xhr.status}`));
      }
    };
    xhr.onerror = () => reject(new Error("Error de red al subir la página."));
    xhr.ontimeout = () => reject(new Error("Tiempo de espera agotado."));
    xhr.timeout = 120_000;

    xhr.send(body);
  });
}

/**
 * Sube las páginas en paralelo (por defecto 4 a la vez) directamente al endpoint
 * /api/upload-page, con reintentos automáticos. Devuelve las URLs de R2 en el
 * mismo orden en que se seleccionaron las páginas.
 */
export async function uploadPagesInParallel({
  files,
  mangaSlug,
  chapterNumber,
  concurrency = 4,
  maxRetries = 2,
  onUpdate,
}: UploadPagesOptions): Promise<string[]> {
  const pages: PageUploadState[] = files.map((f) => ({
    name: f.name,
    size: f.size,
    loaded: 0,
    status: "pending",
  }));

  // Limitar la frecuencia de renderizado para no saturar React con eventos de progreso
  const startedAt = performance.now();
  const snapshot = () => {
    const elapsed = (performance.now() - startedAt) / 1000;
    const loaded = pages.reduce((acc, p) => acc + p.loaded, 0);
    const speed = elapsed > 0.5 ? loaded / elapsed : 0;
    onUpdate(
      pages.map((p) => ({ ...p })),
      speed
    );
  };

  let frameScheduled = false;
  const emit = (immediate = false) => {
    if (immediate) {
      snapshot();
      return;
    }
    if (frameScheduled) return;
    frameScheduled = true;
    requestAnimationFrame(() => {
      frameScheduled = false;
      snapshot();
    });
  };

  emit(true);

  let nextIndex = 0;

  const worker = async () => {
    while (nextIndex < files.length) {
      const index = nextIndex++;
      const file = files[index];
      const page = pages[index];

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        page.status = "uploading";
        page.loaded = 0;
        page.error = undefined;
        emit(true);
        try {
          const url = await uploadSinglePage(
            file,
            {
              mangaSlug,
              chapterNumber,
              pageIndex: String(index),
            },
            (loaded) => {
              page.loaded = loaded;
              emit();
            }
          );
          page.url = url;
          page.loaded = file.size;
          page.status = "done";
          emit(true);
          break;
        } catch (err) {
          page.error = err instanceof Error ? err.message : "Error desconocido";
          if (attempt === maxRetries) {
            page.status = "error";
            emit(true);
          } else {
            // Espera progresiva antes de reintentar
            await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
          }
        }
      }
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(concurrency, files.length) }, worker)
  );

  const failed = pages.filter((p) => p.status === "error");
  if (failed.length > 0) {
    throw new Error(
      `No se pudieron subir ${failed.length} página(s): ${failed
        .slice(0, 3)
        .map((p) => p.name)
        .join(", ")}${failed.length > 3 ? "..." : ""}`
    );
  }

  return pages.map((p) => p.url!);
}
