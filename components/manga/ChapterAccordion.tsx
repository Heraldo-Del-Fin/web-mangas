"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Chapter } from "@/lib/types";

export const READ_CHAPTERS_KEY = "tmo_read_chapters_v1";

export function ChapterAccordion({
  chapters,
  mangaId,
  canUpload = false,
}: {
  chapters: Chapter[];
  mangaId: string;
  mangaSlug: string;
  canUpload?: boolean;
}) {
  const [sortDesc, setSortDesc] = useState(true);
  const [searchNum, setSearchNum] = useState("");
  const [openChapters, setOpenChapters] = useState<Record<string, boolean>>({});
  const [readIds, setReadIds] = useState<Record<string, boolean>>({});

  useEffect(() => {
    try {
      const raw = localStorage.getItem(READ_CHAPTERS_KEY);
      if (raw) {
        setReadIds(JSON.parse(raw));
      }
      if (chapters.length > 0) {
        const latest = chapters[chapters.length - 1];
        setOpenChapters({ [latest.id]: true });
      }
    } catch {
      // ignore
    }
  }, [chapters]);

  const toggleRead = (chapterId: string) => {
    setReadIds((prev) => {
      const next = { ...prev, [chapterId]: !prev[chapterId] };
      try {
        localStorage.setItem(READ_CHAPTERS_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const markAllRead = () => {
    const next = { ...readIds };
    for (const c of chapters) {
      next[c.id] = true;
    }
    setReadIds(next);
    try {
      localStorage.setItem(READ_CHAPTERS_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  };

  const toggleOpen = (chapterId: string) => {
    setOpenChapters((prev) => ({
      ...prev,
      [chapterId]: !prev[chapterId],
    }));
  };

  const filtered = chapters
    .filter((c) => {
      if (!searchNum.trim()) return true;
      return (
        String(c.number).includes(searchNum.trim()) ||
        c.title.toLowerCase().includes(searchNum.trim().toLowerCase())
      );
    })
    .sort((a, b) => (sortDesc ? b.number - a.number : a.number - b.number));

  if (chapters.length === 0) {
    return (
      <div className="border border-zinc-300 bg-white p-8 text-center">
        <p className="text-sm font-bold text-zinc-800">
          Esta obra aún no tiene capítulos publicados.
        </p>
        {canUpload && (
          <>
            <p className="mt-1 text-xs text-zinc-500">
              Puedes publicar el primer capítulo desde el panel de Scanlations.
            </p>
            <Link
              href={`/subir?tab=chapter&mangaId=${encodeURIComponent(mangaId)}`}
              className="mt-4 inline-block border border-[#1e40af] bg-[#1d4ed8] px-4 py-2 text-xs font-extrabold text-white uppercase hover:bg-[#1e40af]"
            >
              + Subir Primer Capítulo
            </Link>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="border border-zinc-300 bg-white shadow-2xs">
      {/* Barra de controles superior (Bordes rectos) */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-zinc-300 bg-zinc-100 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={searchNum}
            onChange={(e) => setSearchNum(e.target.value)}
            placeholder="Filtrar cap. (ej: 1, 2...)"
            className="w-44 rounded-none border border-zinc-400 bg-white px-2.5 py-1 text-xs text-zinc-900 placeholder-zinc-500 focus:border-[#1d4ed8] focus:outline-none"
          />
          <button
            type="button"
            onClick={() => setSortDesc((p) => !p)}
            className="border border-zinc-400 bg-white px-3 py-1 text-xs font-bold text-zinc-800 hover:bg-zinc-200"
          >
            {sortDesc ? "↓ Orden: Más recientes" : "↑ Orden: Desde Cap. 1"}
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={markAllRead}
            className="border border-zinc-400 bg-white px-3 py-1 text-xs font-bold text-zinc-700 hover:bg-zinc-200"
          >
            ✓ Marcar todos leídos
          </button>
          {canUpload && (
            <Link
              href={`/subir?tab=chapter&mangaId=${encodeURIComponent(mangaId)}`}
              className="border border-[#1e40af] bg-[#1d4ed8] px-3 py-1 text-xs font-extrabold text-white uppercase hover:bg-[#1e40af]"
            >
              + Subir Capítulo
            </Link>
          )}
        </div>
      </div>

      {/* Tabla de capítulos estilo clásico */}
      <div className="divide-y divide-zinc-200">
        {filtered.map((chapter) => {
          const isOpen = !!openChapters[chapter.id];
          const isRead = !!readIds[chapter.id];
          const primaryUpload = chapter.uploads[0];

          return (
            <div key={chapter.id} className="bg-white">
              {/* Fila principal del capítulo */}
              <div className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-zinc-50">
                <button
                  type="button"
                  onClick={() => toggleOpen(chapter.id)}
                  className="flex flex-1 items-center gap-3 text-left"
                >
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center border text-xs font-extrabold ${
                      isOpen
                        ? "border-zinc-900 bg-zinc-900 text-white"
                        : "border-zinc-400 bg-zinc-100 text-zinc-800"
                    }`}
                  >
                    {isOpen ? "−" : "+"}
                  </span>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`text-xs font-extrabold sm:text-sm ${
                          isRead ? "text-zinc-400 line-through" : "text-zinc-900"
                        }`}
                      >
                        Capítulo {chapter.number}
                      </span>
                      {chapter.title && (
                        <span className="text-xs text-zinc-600">
                          — {chapter.title}
                        </span>
                      )}
                    </div>
                  </div>
                </button>

                <div className="flex items-center gap-2">
                  <span className="hidden text-[11px] font-medium text-zinc-500 sm:inline">
                    {chapter.uploads.length} versión(es)
                  </span>

                  <button
                    type="button"
                    onClick={() => toggleRead(chapter.id)}
                    title={isRead ? "Marcar no leído" : "Marcar leído"}
                    className={`border px-2.5 py-1 text-xs font-bold ${
                      isRead
                        ? "border-emerald-600 bg-emerald-50 text-emerald-800"
                        : "border-zinc-300 bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                    }`}
                  >
                    {isRead ? "✓ Leído" : "👁️ Visto"}
                  </button>

                  {primaryUpload && (
                    <Link
                      href={`/leer/${primaryUpload.id}`}
                      onClick={() => {
                        if (!isRead) toggleRead(chapter.id);
                      }}
                      className="border border-[#1e40af] bg-[#1d4ed8] px-3 py-1 text-xs font-extrabold text-white uppercase hover:bg-[#1e40af]"
                    >
                      ▶ Leer
                    </Link>
                  )}
                </div>
              </div>

              {/* Sub-filas desplegables por Scanlation (Tabla interna clásica) */}
              {isOpen && (
                <div className="border-t border-zinc-200 bg-zinc-50 px-4 py-2">
                  <div className="divide-y divide-zinc-200 border border-zinc-300 bg-white">
                    {chapter.uploads.map((up) => (
                      <div
                        key={up.id}
                        className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-xs"
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="border border-zinc-400 bg-zinc-100 px-1.5 py-0.5 text-[10px] font-extrabold text-zinc-800 uppercase">
                            {up.language}
                          </span>
                          <span className="font-extrabold text-[#1d4ed8]">
                            {up.scanlationName}
                          </span>
                          <span className="text-zinc-500">
                            ({up.pages.length} págs)
                          </span>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="text-[11px] text-zinc-500">
                            {new Date(up.createdAt).toLocaleDateString(
                              "es-ES",
                              {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              }
                            )}
                          </span>
                          <Link
                            href={`/leer/${up.id}`}
                            onClick={() => {
                              if (!isRead) toggleRead(chapter.id);
                            }}
                            className="border border-zinc-800 bg-zinc-900 px-3 py-1 text-[11px] font-extrabold text-white uppercase hover:bg-[#1d4ed8] hover:border-[#1e40af]"
                          >
                            Abrir Lector »
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
