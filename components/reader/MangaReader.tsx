"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { READ_CHAPTERS_KEY } from "@/components/manga/ChapterAccordion";
import { CommentsBox } from "@/components/manga/CommentsBox";
import {
  READING_HISTORY_KEY,
  ReadingHistoryEntry,
} from "@/components/manga/ReadingHistoryBar";
import { ChapterUpload, Manga } from "@/lib/types";

type ReaderMode = "cascade" | "paginated";
type WidthPreset = "compact" | "normal" | "wide";
type PaperTone = "white" | "sepia" | "gray";

export function MangaReader({
  upload,
  manga,
  prevUploadId,
  nextUploadId,
  allChapterUploads,
}: {
  upload: ChapterUpload;
  manga: Manga;
  prevUploadId: string | null;
  nextUploadId: string | null;
  allChapterUploads: {
    chapterNumber: number;
    chapterTitle: string;
    uploadId: string;
  }[];
}) {
  const router = useRouter();
  const [mode, setMode] = useState<ReaderMode>("cascade");
  const [widthPreset, setWidthPreset] = useState<WidthPreset>("normal");
  const [paperTone, setPaperTone] = useState<PaperTone>("white");
  const [currentPage, setCurrentPage] = useState(0);
  const [barPinned, setBarPinned] = useState(true);

  const totalPages = upload.pages.length;

  useEffect(() => {
    try {
      const raw = localStorage.getItem(READ_CHAPTERS_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      parsed[upload.chapterId] = true;
      localStorage.setItem(READ_CHAPTERS_KEY, JSON.stringify(parsed));

      // Guardar también en el historial reciente de lectura ("Continuar leyendo")
      const rawHist = localStorage.getItem(READING_HISTORY_KEY);
      const histList: ReadingHistoryEntry[] = rawHist
        ? JSON.parse(rawHist)
        : [];
      const filteredHist = histList.filter(
        (h) => h.mangaSlug !== manga.slug
      );
      filteredHist.unshift({
        uploadId: upload.id,
        mangaSlug: manga.slug,
        mangaTitle: manga.title,
        mangaCover: manga.coverUrl,
        chapterNumber: upload.chapterNumber,
        chapterTitle: upload.chapterTitle,
        scanlationName: upload.scanlationName,
        readAt: new Date().toISOString(),
      });
      localStorage.setItem(
        READING_HISTORY_KEY,
        JSON.stringify(filteredHist.slice(0, 12))
      );
    } catch {
      // ignore
    }
  }, [
    upload.chapterId,
    upload.id,
    upload.chapterNumber,
    upload.chapterTitle,
    upload.scanlationName,
    manga.slug,
    manga.title,
    manga.coverUrl,
  ]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (mode !== "paginated") return;
      if (e.key === "ArrowRight") {
        setCurrentPage((p) => Math.min(totalPages - 1, p + 1));
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else if (e.key === "ArrowLeft") {
        setCurrentPage((p) => Math.max(0, p - 1));
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mode, totalPages]);

  const widthClassMap: Record<WidthPreset, string> = {
    compact: "max-w-2xl",
    normal: "max-w-4xl",
    wide: "max-w-6xl",
  };

  const toneBgMap: Record<PaperTone, string> = {
    white: "bg-[#f4f5f7] text-zinc-900",
    sepia: "bg-[#f3ead8] text-stone-900",
    gray: "bg-[#e4e4e7] text-zinc-900",
  };

  return (
    <div className={`min-h-screen ${toneBgMap[paperTone]}`}>
      {/* Barra Superior Clásica de Lector (Bordes rectos, fondo blanco) */}
      <header
        className={`${
          barPinned ? "sticky top-0" : "relative"
        } z-50 border-b-2 border-zinc-300 bg-white shadow-xs`}
      >
        {/* Sub-barra de migas de pan estilo portal clásico */}
        <div className="border-b border-zinc-200 bg-zinc-100 px-4 py-1.5 text-xs">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 font-semibold text-zinc-700">
              <Link
                href="/"
                className="font-black text-[#d9381e] hover:underline"
              >
                KuraManga
              </Link>
              <span className="text-zinc-400">»</span>
              <Link
                href={`/manga/${manga.slug}`}
                className="font-bold text-[#1d4ed8] hover:underline"
              >
                {manga.title}
              </Link>
              <span className="text-zinc-400">»</span>
              <span className="font-bold text-zinc-900">
                Capítulo {upload.chapterNumber}
              </span>
            </div>

            <div className="flex items-center gap-3 text-[11px] text-zinc-600">
              <span>
                Scanlation:{" "}
                <strong className="text-zinc-900">
                  {upload.scanlationName}
                </strong>
              </span>
              <span>|</span>
              <button
                type="button"
                onClick={() => setBarPinned((v) => !v)}
                className="font-bold text-[#1d4ed8] hover:underline"
              >
                {barPinned ? "[ Desfijar barra ]" : "[ Fijar barra arriba ]"}
              </button>
            </div>
          </div>
        </div>

        {/* Barra de Herramientas del Lector (Controles Rectangulares Clásicos) */}
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-2.5">
          {/* Izquierda: Volver a la Ficha */}
          <div className="flex items-center gap-2">
            <Link
              href={`/manga/${manga.slug}`}
              className="border border-zinc-400 bg-zinc-100 px-3 py-1.5 text-xs font-extrabold text-zinc-800 uppercase hover:bg-zinc-200"
            >
              ◄ Ficha de Obra
            </Link>
            <Link
              href="/biblioteca"
              className="hidden border border-zinc-300 bg-white px-3 py-1.5 text-xs font-bold text-zinc-700 hover:bg-zinc-100 sm:inline-block"
            >
              Directorio
            </Link>
          </div>

          {/* Centro: Selector de Capítulo y Botones Ant / Sig */}
          <div className="flex items-center gap-1.5">
            {prevUploadId ? (
              <Link
                href={`/leer/${prevUploadId}`}
                className="border border-zinc-400 bg-zinc-100 px-3 py-1.5 text-xs font-extrabold text-zinc-800 hover:bg-zinc-200"
                title="Capítulo Anterior"
              >
                « Cap. Ant
              </Link>
            ) : (
              <span className="cursor-not-allowed border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs font-bold text-zinc-400">
                « Cap. Ant
              </span>
            )}

            <select
              aria-label="Seleccionar capítulo"
              value={upload.id}
              onChange={(e) => router.push(`/leer/${e.target.value}`)}
              className="rounded-none border border-zinc-400 bg-white px-3 py-1.5 text-xs font-extrabold text-zinc-900 focus:border-[#1d4ed8] focus:outline-none"
            >
              {allChapterUploads.map((item) => (
                <option key={item.uploadId} value={item.uploadId}>
                  Capítulo {item.chapterNumber} — {item.chapterTitle}
                </option>
              ))}
            </select>

            {nextUploadId ? (
              <Link
                href={`/leer/${nextUploadId}`}
                className="border border-[#1e40af] bg-[#1d4ed8] px-3 py-1.5 text-xs font-extrabold text-white hover:bg-[#1e40af]"
                title="Capítulo Siguiente"
              >
                Cap. Sig »
              </Link>
            ) : (
              <span className="cursor-not-allowed border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs font-bold text-zinc-400">
                Cap. Sig »
              </span>
            )}
          </div>

          {/* Derecha: Modo Cascada / Paginado + Ancho + Fondo */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Switch Recto Cascada / Paginado */}
            <div className="inline-flex border border-zinc-400 bg-zinc-100">
              <button
                type="button"
                onClick={() => setMode("cascade")}
                className={`px-3 py-1.5 text-xs font-extrabold uppercase transition ${
                  mode === "cascade"
                    ? "bg-[#1d4ed8] text-white"
                    : "text-zinc-700 hover:bg-zinc-200"
                }`}
              >
                Cascada
              </button>
              <button
                type="button"
                onClick={() => setMode("paginated")}
                className={`border-l border-zinc-400 px-3 py-1.5 text-xs font-extrabold uppercase transition ${
                  mode === "paginated"
                    ? "bg-[#1d4ed8] text-white"
                    : "text-zinc-700 hover:bg-zinc-200"
                }`}
              >
                Paginado
              </button>
            </div>

            {/* Selector de Ancho */}
            <select
              aria-label="Ancho de página"
              value={widthPreset}
              onChange={(e) => setWidthPreset(e.target.value as WidthPreset)}
              className="hidden rounded-none border border-zinc-400 bg-white px-2.5 py-1.5 text-xs font-bold text-zinc-800 lg:block"
            >
              <option value="compact">Ancho: Compacto</option>
              <option value="normal">Ancho: Clásico</option>
              <option value="wide">Ancho: Extendido</option>
            </select>

            {/* Selector de Papel */}
            <select
              aria-label="Color de fondo"
              value={paperTone}
              onChange={(e) => setPaperTone(e.target.value as PaperTone)}
              className="hidden rounded-none border border-zinc-400 bg-white px-2.5 py-1.5 text-xs font-bold text-zinc-800 sm:block"
            >
              <option value="white">Fondo: Blanco Clásico</option>
              <option value="sepia">Fondo: Papel Sepia</option>
              <option value="gray">Fondo: Gris Suave</option>
            </select>
          </div>
        </div>
      </header>

      {/* Lienzo Principal del Lector */}
      <main
        className={`mx-auto w-full ${widthClassMap[widthPreset]} px-2 py-6 sm:px-4`}
      >
        {/* Cabecera Editorial del Capítulo */}
        <div className="mb-5 border border-zinc-300 bg-white p-4 shadow-2xs">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 pb-2.5">
            <div>
              <span className="border border-zinc-400 bg-zinc-100 px-2 py-0.5 text-[10px] font-extrabold text-zinc-800 uppercase">
                {upload.scanlationName}
              </span>
              <h1 className="mt-1.5 text-base font-black text-zinc-900 sm:text-xl">
                {manga.title} — Capítulo {upload.chapterNumber}:{" "}
                {upload.chapterTitle}
              </h1>
            </div>
            <div className="flex flex-col items-end gap-1.5 text-right text-xs text-zinc-600">
              <div className="flex items-center gap-2">
                <Link
                  href={`/editar-capitulo/${upload.id}`}
                  className="border border-zinc-400 bg-zinc-100 px-2.5 py-1 text-xs font-bold text-zinc-800 hover:bg-zinc-200"
                >
                  ⚙️ Editar Capítulo
                </Link>
                <p className="font-bold text-zinc-900">
                  Total: {totalPages} páginas
                </p>
              </div>
              <p>
                Vista:{" "}
                <strong className="text-[#1d4ed8] uppercase">
                  {mode === "cascade" ? "Tira / Cascada" : "Hoja por Hoja"}
                </strong>
              </p>
            </div>
          </div>

          <p className="mt-2 text-xs text-zinc-600">
            💡 <strong>Consejo de lectura:</strong>{" "}
            {mode === "cascade"
              ? "Desplázate hacia abajo para leer todas las páginas seguidas. Puedes cambiar a modo «Paginado» en la barra superior."
              : "Haz clic en el lado derecho de la hoja (o pulsa la tecla ►) para avanzar a la siguiente página, y en el lado izquierdo (◄) para retroceder."}
          </p>
        </div>

        {/* MODO CASCADA CLÁSICO */}
        {mode === "cascade" ? (
          <div className="flex flex-col items-center space-y-4">
            {upload.pages.map((pageUrl, idx) => (
              <div
                key={`${upload.id}-page-${idx}`}
                className="w-full border border-zinc-300 bg-white p-1.5 shadow-xs sm:p-2.5"
              >
                <div className="mb-1.5 flex items-center justify-between border-b border-zinc-200 pb-1 text-[11px] font-bold text-zinc-500">
                  <span>{manga.title}</span>
                  <span>
                    PÁGINA {idx + 1} DE {totalPages}
                  </span>
                </div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={pageUrl}
                  alt={`Página ${idx + 1}`}
                  className="mx-auto block h-auto w-full border border-zinc-200 select-none"
                />
              </div>
            ))}
          </div>
        ) : (
          /* MODO PAGINADO CLÁSICO (Estilo MangaReader / Batoto / MangaDex) */
          <div className="space-y-4">
            {/* Barra de Paginación Superior */}
            <div className="flex flex-wrap items-center justify-between gap-2 border border-zinc-300 bg-white px-3 py-2 shadow-2xs">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={currentPage === 0}
                  onClick={() => {
                    setCurrentPage(0);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  className="border border-zinc-300 bg-zinc-100 px-2.5 py-1 text-xs font-bold text-zinc-800 hover:bg-zinc-200 disabled:opacity-40"
                >
                  « Primera
                </button>
                <button
                  type="button"
                  disabled={currentPage === 0}
                  onClick={() => {
                    setCurrentPage((p) => Math.max(0, p - 1));
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  className="border border-zinc-400 bg-zinc-100 px-3 py-1 text-xs font-extrabold text-zinc-900 hover:bg-zinc-200 disabled:opacity-40"
                >
                  ‹ Anterior
                </button>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-zinc-700">Hoja:</span>
                <select
                  aria-label="Ir a la página"
                  value={currentPage}
                  onChange={(e) => setCurrentPage(Number(e.target.value))}
                  className="rounded-none border border-zinc-400 bg-zinc-50 px-3 py-1 text-xs font-extrabold text-[#1d4ed8]"
                >
                  {upload.pages.map((_, idx) => (
                    <option key={idx} value={idx}>
                      Página {idx + 1} de {totalPages}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={currentPage >= totalPages - 1}
                  onClick={() => {
                    setCurrentPage((p) => Math.min(totalPages - 1, p + 1));
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  className="border border-[#1e40af] bg-[#1d4ed8] px-3 py-1 text-xs font-extrabold text-white hover:bg-[#1e40af] disabled:opacity-40"
                >
                  Siguiente ›
                </button>
                <button
                  type="button"
                  disabled={currentPage >= totalPages - 1}
                  onClick={() => {
                    setCurrentPage(totalPages - 1);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  className="border border-zinc-300 bg-zinc-100 px-2.5 py-1 text-xs font-bold text-zinc-800 hover:bg-zinc-200 disabled:opacity-40"
                >
                  Última »
                </button>
              </div>
            </div>

            {/* Marco de Página Clásico */}
            <div
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const clickX = e.clientX - rect.left;
                if (clickX < rect.width * 0.35) {
                  setCurrentPage((p) => Math.max(0, p - 1));
                } else {
                  setCurrentPage((p) => Math.min(totalPages - 1, p + 1));
                }
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              className="cursor-pointer border border-zinc-300 bg-white p-2 shadow-sm sm:p-3"
              title="Clic a la derecha para avanzar, clic a la izquierda para retroceder"
            >
              <div className="mb-2 flex items-center justify-between border-b border-zinc-200 pb-1.5 text-xs font-bold text-zinc-600">
                <span>
                  Cap. {upload.chapterNumber} — {upload.scanlationName}
                </span>
                <span className="bg-zinc-900 px-2 py-0.5 text-[11px] font-extrabold text-white">
                  PÁG. {currentPage + 1} / {totalPages}
                </span>
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={upload.pages[currentPage]}
                alt={`Página ${currentPage + 1}`}
                className="mx-auto block h-auto w-full border border-zinc-200 select-none"
              />
            </div>

            {/* Barra de Paginación Inferior */}
            <div className="flex items-center justify-between border border-zinc-300 bg-white px-3 py-2 shadow-2xs">
              <button
                type="button"
                disabled={currentPage === 0}
                onClick={() => {
                  setCurrentPage((p) => Math.max(0, p - 1));
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                className="border border-zinc-400 bg-zinc-100 px-4 py-1.5 text-xs font-extrabold text-zinc-900 hover:bg-zinc-200 disabled:opacity-40"
              >
                ◄ Página Anterior
              </button>
              <span className="text-xs font-extrabold text-zinc-800">
                Página {currentPage + 1} de {totalPages}
              </span>
              <button
                type="button"
                disabled={currentPage >= totalPages - 1}
                onClick={() => {
                  setCurrentPage((p) => Math.min(totalPages - 1, p + 1));
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                className="border border-[#1e40af] bg-[#1d4ed8] px-4 py-1.5 text-xs font-extrabold text-white hover:bg-[#1e40af] disabled:opacity-40"
              >
                Página Siguiente ►
              </button>
            </div>
          </div>
        )}

        {/* Caja de Fin de Capítulo Clásica (Bordes rectos) */}
        <div className="mt-8 border-2 border-zinc-300 bg-white p-6 text-center shadow-xs">
          <p className="text-xs font-extrabold tracking-widest text-zinc-500 uppercase">
            Fin del Capítulo {upload.chapterNumber}
          </p>
          <h2 className="mt-1 text-lg font-black text-zinc-900">
            {manga.title}
          </h2>
          <p className="mt-0.5 text-xs text-zinc-500">
            Publicado por {upload.scanlationName}
          </p>

          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            {prevUploadId && (
              <Link
                href={`/leer/${prevUploadId}`}
                className="border border-zinc-400 bg-zinc-100 px-5 py-2 text-xs font-extrabold text-zinc-800 uppercase hover:bg-zinc-200"
              >
                « Capítulo Anterior
              </Link>
            )}
            <Link
              href={`/manga/${manga.slug}`}
              className="border border-zinc-400 bg-white px-5 py-2 text-xs font-extrabold text-zinc-900 uppercase hover:bg-zinc-100"
            >
              Índice de Capítulos
            </Link>
            {nextUploadId ? (
              <Link
                href={`/leer/${nextUploadId}`}
                className="border border-[#1e40af] bg-[#1d4ed8] px-6 py-2 text-xs font-extrabold text-white uppercase hover:bg-[#1e40af]"
              >
                Siguiente Capítulo »
              </Link>
            ) : (
              <Link
                href={`/subir?tab=chapter&mangaId=${encodeURIComponent(manga.id)}`}
                className="border border-emerald-800 bg-emerald-700 px-5 py-2 text-xs font-extrabold text-white uppercase hover:bg-emerald-800"
              >
                + Subir Nuevo Capítulo
              </Link>
            )}
          </div>
        </div>

        {/* Comentarios del Capítulo */}
        <div className="mt-6">
          <CommentsBox
            mangaId={manga.id}
            chapterNumber={upload.chapterNumber}
            comments={manga.comments || []}
          />
        </div>
      </main>
    </div>
  );
}
