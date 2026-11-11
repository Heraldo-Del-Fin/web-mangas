"use client";

import type { PageUploadState } from "./chapter-uploader";

export type UploadPhase = "uploading" | "saving" | "done" | "error";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function UploadProgressPanel({
  pages,
  phase,
  speed,
  errorMessage,
}: {
  pages: PageUploadState[];
  phase: UploadPhase;
  speed: number;
  errorMessage?: string | null;
}) {
  const totalBytes = pages.reduce((acc, p) => acc + p.size, 0);
  const loadedBytes = pages.reduce((acc, p) => acc + p.loaded, 0);
  const donePages = pages.filter((p) => p.status === "done").length;
  const percent =
    phase === "saving" || phase === "done"
      ? 100
      : totalBytes > 0
        ? Math.min(99, Math.round((loadedBytes / totalBytes) * 100))
        : 0;

  const remainingSec =
    speed > 0 && phase === "uploading"
      ? Math.max(0, Math.round((totalBytes - loadedBytes) / speed))
      : null;

  const phaseLabel = {
    uploading: `Subiendo páginas a Cloudflare R2 (${donePages}/${pages.length})`,
    saving: "Registrando capítulo en la base de datos...",
    done: "¡Capítulo publicado! Abriendo el lector...",
    error: "La subida se detuvo",
  }[phase];

  const barColor =
    phase === "error"
      ? "bg-rose-600"
      : phase === "done"
        ? "bg-emerald-600"
        : "bg-[#1d4ed8]";

  return (
    <div
      className="border-2 border-zinc-900 bg-white shadow-xs"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center justify-between border-b border-zinc-300 bg-zinc-900 px-4 py-2 text-xs font-extrabold tracking-wider text-white uppercase">
        <span className="flex items-center gap-2">
          {phase !== "error" && phase !== "done" && (
            <span className="upload-spinner inline-block h-3 w-3 border-2 border-white border-t-transparent" />
          )}
          {phaseLabel}
        </span>
        <span className="text-amber-400 tabular-nums">{percent}%</span>
      </div>

      <div className="space-y-3 p-4">
        {/* Barra global */}
        <div className="h-5 w-full border border-zinc-400 bg-zinc-100">
          <div
            className={`upload-bar h-full ${barColor} ${
              phase === "uploading" || phase === "saving" ? "upload-stripes" : ""
            }`}
            style={{ width: `${percent}%` }}
          />
        </div>

        <div className="flex flex-wrap justify-between gap-2 text-[11px] font-semibold text-zinc-600 tabular-nums">
          <span>
            {formatBytes(loadedBytes)} / {formatBytes(totalBytes)}
          </span>
          {phase === "uploading" && speed > 0 && (
            <span>
              {formatBytes(speed)}/s
              {remainingSec !== null && ` • ~${remainingSec}s restantes`}
            </span>
          )}
        </div>

        {errorMessage && (
          <div className="border border-rose-500 bg-rose-50 p-2.5 text-xs font-bold text-rose-800">
            ⚠️ {errorMessage}
          </div>
        )}

        {/* Mosaico de páginas */}
        <div className="grid grid-cols-6 gap-1 sm:grid-cols-10 md:grid-cols-12">
          {pages.map((p, idx) => {
            const pagePercent =
              p.size > 0 ? Math.round((p.loaded / p.size) * 100) : 0;
            return (
              <div
                key={`${p.name}-${idx}`}
                title={`Pág. ${idx + 1}: ${p.name}${p.error ? ` — ${p.error}` : ""}`}
                className={`relative h-9 overflow-hidden border text-center text-[10px] leading-9 font-black tabular-nums transition-colors ${
                  p.status === "done"
                    ? "upload-pop border-emerald-700 bg-emerald-600 text-white"
                    : p.status === "error"
                      ? "border-rose-700 bg-rose-600 text-white"
                      : p.status === "uploading"
                        ? "border-[#1e40af] bg-blue-50 text-[#1d4ed8]"
                        : "border-zinc-300 bg-zinc-50 text-zinc-400"
                }`}
              >
                {p.status === "uploading" && (
                  <span
                    className="absolute bottom-0 left-0 h-1 bg-[#1d4ed8] transition-[width] duration-150"
                    style={{ width: `${pagePercent}%` }}
                  />
                )}
                <span className="relative">
                  {p.status === "done" ? "✓" : p.status === "error" ? "✕" : idx + 1}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
