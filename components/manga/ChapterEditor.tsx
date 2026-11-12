"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { updateChapterAction } from "@/lib/actions";
import { deleteChapterUploadAction } from "@/lib/auth-actions";
import { ChapterUpload, Manga, ScanlationGroup } from "@/lib/types";
import {
  PageUploadState,
  uploadPagesInParallel,
} from "../upload/chapter-uploader";
import { UploadPhase, UploadProgressPanel } from "../upload/UploadProgressPanel";

interface PageItem {
  id: string;
  url: string;
  isNew?: boolean;
}

export function ChapterEditor({
  upload,
  manga,
  scanlations,
}: {
  upload: ChapterUpload;
  manga: Manga;
  scanlations: ScanlationGroup[];
}) {
  const router = useRouter();

  const [chapterNumber, setChapterNumber] = useState(upload.chapterNumber);
  const [chapterTitle, setChapterTitle] = useState(upload.chapterTitle || "");
  const [scanlationId, setScanlationId] = useState(upload.scanlationId);

  // Lista interactiva de páginas (URLs actuales)
  const [pages, setPages] = useState<PageItem[]>(
    upload.pages.map((url, idx) => ({ id: `orig-${idx}`, url }))
  );

  // Nuevas imágenes seleccionadas para agregar
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [pastedUrls, setPastedUrls] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Estado del panel de subida de imágenes adicionales
  const [uploadPhase, setUploadPhase] = useState<UploadPhase | null>(null);
  const [uploadPages, setUploadPages] = useState<PageUploadState[]>([]);
  const [uploadSpeed, setUploadSpeed] = useState(0);

  // Estado para confirmación de eliminación
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const movePage = (index: number, direction: -1 | 1) => {
    setPages((prev) => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      const temp = next[index];
      next[index] = next[target];
      next[target] = temp;
      return next;
    });
  };

  const removePage = (index: number) => {
    setPages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddNewFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      setNewFiles((prev) => [...prev, ...files]);
    }
  };

  const removeNewFile = (index: number) => {
    setNewFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleDeleteChapter = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }

    setDeleting(true);
    setError(null);

    const res = await deleteChapterUploadAction(upload.id);
    setDeleting(false);

    if (!res.success) {
      setError(res.error || "No se pudo eliminar el capítulo.");
      return;
    }

    router.push(`/manga/${manga.slug}`);
    router.refresh();
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (pages.length === 0 && newFiles.length === 0 && !pastedUrls.trim()) {
      setError("El capítulo no puede quedar sin páginas.");
      return;
    }

    setLoading(true);

    // 1) Si hay archivos nuevos, subirlos primero en paralelo a R2
    let uploadedUrls: string[] = [];
    if (newFiles.length > 0) {
      setUploadPhase("uploading");
      try {
        uploadedUrls = await uploadPagesInParallel({
          files: newFiles,
          mangaSlug: manga.slug,
          chapterNumber: String(chapterNumber),
          onUpdate: (uPages, speed) => {
            setUploadPages(uPages);
            setUploadSpeed(speed);
          },
        });
      } catch (err) {
        setUploadPhase("error");
        setError(
          err instanceof Error
            ? err.message
            : "Error al subir las nuevas páginas."
        );
        setLoading(false);
        return;
      }
    }

    // 2) Armar la lista definitiva de URLs (páginas existentes reordenadas + nuevas)
    const extraPasted = pastedUrls
      .split(/\r?\n/)
      .map((u) => u.trim())
      .filter(Boolean);

    const finalPages = [
      ...pages.map((p) => p.url),
      ...uploadedUrls,
      ...extraPasted,
    ];

    setUploadPhase("saving");

    const formData = new FormData();
    formData.set("uploadId", upload.id);
    formData.set("chapterNumber", String(chapterNumber));
    formData.set("chapterTitle", chapterTitle);
    formData.set("scanlationId", scanlationId);
    formData.set("pageUrls", finalPages.join("\n"));

    const res = await updateChapterAction(formData);

    if (!res.success) {
      setUploadPhase("error");
      setError(res.error || "No se pudo actualizar el capítulo.");
      setLoading(false);
      return;
    }

    setUploadPhase("done");
    router.push(`/leer/${upload.id}`);
    router.refresh();
  };

  return (
    <div className="space-y-6">
      {/* Barra de cabecera con volver y eliminar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border border-zinc-300 bg-white px-5 py-4 shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="border border-zinc-400 bg-zinc-100 px-2 py-0.5 text-[10px] font-black uppercase">
              Modo Edición
            </span>
            <Link
              href={`/manga/${manga.slug}`}
              className="text-xs font-bold text-[#1d4ed8] hover:underline"
            >
              « Volver a {manga.title}
            </Link>
          </div>
          <h1 className="mt-1 text-xl font-black text-zinc-900 uppercase sm:text-2xl">
            Editar Capítulo {upload.chapterNumber}
          </h1>
        </div>

        <div className="flex items-center gap-2">
          {confirmDelete ? (
            <div className="flex items-center gap-2 border border-rose-300 bg-rose-50 p-1.5">
              <span className="text-xs font-bold text-rose-800">
                ¿Seguro que deseas borrar este capítulo?
              </span>
              <button
                type="button"
                onClick={handleDeleteChapter}
                disabled={deleting}
                className="border border-rose-700 bg-rose-600 px-3 py-1 text-xs font-extrabold text-white uppercase hover:bg-rose-700"
              >
                {deleting ? "Borrando..." : "Sí, Eliminar"}
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="border border-zinc-400 bg-white px-2.5 py-1 text-xs font-bold text-zinc-700"
              >
                Cancelar
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="border border-rose-300 bg-rose-50 px-3 py-1.5 text-xs font-extrabold text-rose-700 uppercase hover:bg-rose-100"
            >
              🗑️ Eliminar Capítulo
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="border border-rose-500 bg-rose-50 p-3.5 text-xs font-bold text-rose-800">
          ⚠️ {error}
        </div>
      )}

      {/* Formulario de edición */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Metadatos básicos */}
        <div className="border border-zinc-300 bg-white p-5 shadow-2xs sm:p-6">
          <h2 className="border-b-2 border-zinc-300 pb-2 text-sm font-black text-zinc-900 uppercase">
            1. Metadatos del Capítulo
          </h2>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-extrabold text-zinc-800 uppercase">
                Número de Capítulo *
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={chapterNumber}
                onChange={(e) => setChapterNumber(Number(e.target.value))}
                required
                className="w-full rounded-none border border-zinc-400 bg-white px-3 py-2 text-xs font-bold text-zinc-900"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-extrabold text-zinc-800 uppercase">
                Título del Capítulo
              </label>
              <input
                type="text"
                value={chapterTitle}
                onChange={(e) => setChapterTitle(e.target.value)}
                placeholder="Ej: El Despertar"
                className="w-full rounded-none border border-zinc-400 bg-white px-3 py-2 text-xs text-zinc-900"
              />
            </div>

            <div className="sm:col-span-3">
              <label htmlFor="edit-chapter-scanlation" className="mb-1 block text-xs font-extrabold text-zinc-800 uppercase">
                Scanlation Asignado
              </label>
              <select
                id="edit-chapter-scanlation"
                value={scanlationId}
                onChange={(e) => setScanlationId(e.target.value)}
                className="w-full rounded-none border border-zinc-400 bg-white px-3 py-2 text-xs font-bold text-zinc-900"
              >
                <option value="">Sin grupo</option>
                {scanlations.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} {s.verified ? "✓" : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Administrador visual de páginas */}
        <div className="border border-zinc-300 bg-white p-5 shadow-2xs sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-zinc-300 pb-2">
            <div>
              <h2 className="text-sm font-black text-zinc-900 uppercase">
                2. Páginas del Capítulo ({pages.length} páginas actuales)
              </h2>
              <p className="text-xs text-zinc-500">
                Usa las flechas para reordenar, la cruz para borrar páginas o
                agrega nuevas imágenes abajo.
              </p>
            </div>
            {pages.length > 0 && (
              <button
                type="button"
                onClick={() => setPages([])}
                className="text-xs font-bold text-rose-700 hover:underline"
              >
                Quitar todas las páginas actuales
              </button>
            )}
          </div>

          {/* Grilla visual de páginas con miniaturas */}
          {pages.length === 0 ? (
            <div className="my-6 border border-dashed border-zinc-400 bg-zinc-50 p-8 text-center text-xs text-zinc-500">
              No hay páginas actuales en el capítulo. Selecciona nuevas imágenes abajo.
            </div>
          ) : (
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
              {pages.map((p, idx) => (
                <div
                  key={p.id}
                  className="flex flex-col border border-zinc-300 bg-zinc-50 p-1 text-center shadow-xs"
                >
                  <div className="relative aspect-[2/3] overflow-hidden border border-zinc-300 bg-zinc-200">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={p.url}
                      alt={`Página ${idx + 1}`}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                    <span className="absolute top-1 left-1 border border-zinc-900 bg-zinc-900/90 px-1 text-[9px] font-black text-white">
                      #{idx + 1}
                    </span>
                  </div>

                  <div className="mt-1 flex items-center justify-between gap-1 pt-1">
                    <button
                      type="button"
                      onClick={() => movePage(idx, -1)}
                      disabled={idx === 0}
                      title="Mover antes"
                      className="flex-1 border border-zinc-300 bg-white py-0.5 text-[10px] font-bold text-zinc-700 hover:bg-zinc-100 disabled:opacity-30"
                    >
                      ←
                    </button>
                    <button
                      type="button"
                      onClick={() => movePage(idx, 1)}
                      disabled={idx === pages.length - 1}
                      title="Mover después"
                      className="flex-1 border border-zinc-300 bg-white py-0.5 text-[10px] font-bold text-zinc-700 hover:bg-zinc-100 disabled:opacity-30"
                    >
                      →
                    </button>
                    <button
                      type="button"
                      onClick={() => removePage(idx)}
                      title="Eliminar página"
                      className="border border-rose-300 bg-rose-50 px-1.5 py-0.5 text-[10px] font-bold text-rose-700 hover:bg-rose-100"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Subida de nuevas imágenes para agregar */}
          <div className="mt-6 border-t border-zinc-200 pt-4">
            <h3 className="text-xs font-black text-zinc-800 uppercase">
              + Agregar Nuevas Páginas al Capítulo
            </h3>
            <p className="text-xs text-zinc-500">
              Las imágenes seleccionadas se subirán directamente a R2 y se
              añadirán al final del capítulo.
            </p>

            <div className="mt-2 border-2 border-dashed border-zinc-400 bg-zinc-50 p-4 text-center hover:border-[#1d4ed8]">
              <input
                id="edit-new-pages-input"
                type="file"
                multiple
                accept="image/*"
                onChange={handleAddNewFiles}
                className="hidden"
              />
              <label
                htmlFor="edit-new-pages-input"
                className="block cursor-pointer space-y-1"
              >
                <p className="text-xs font-extrabold text-[#1d4ed8] uppercase">
                  [ Seleccionar archivos de imagen adicionales ]
                </p>
                <p className="text-[11px] text-zinc-600">
                  Formatos: .jpg, .png, .webp
                </p>
              </label>
            </div>

            {newFiles.length > 0 && (
              <div className="mt-3 border border-zinc-300 bg-zinc-50 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-extrabold text-zinc-900">
                    {newFiles.length} nuevas imágenes listas para subir:
                  </span>
                  <button
                    type="button"
                    onClick={() => setNewFiles([])}
                    className="text-xs font-bold text-rose-700 hover:underline"
                  >
                    Vaciar nuevas
                  </button>
                </div>
                <div className="grid grid-cols-1 gap-1 sm:grid-cols-2 md:grid-cols-3">
                  {newFiles.map((file, idx) => (
                    <div
                      key={`${file.name}-${idx}`}
                      className="flex items-center justify-between border border-zinc-300 bg-white px-2 py-1 text-xs"
                    >
                      <span className="truncate font-semibold text-zinc-800">
                        +{idx + 1}: {file.name}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeNewFile(idx)}
                        className="text-rose-700 hover:font-bold"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-4">
              <label className="mb-1 block text-xs font-bold text-zinc-700">
                O agregar URLs de imagen adicionales (una por línea):
              </label>
              <textarea
                value={pastedUrls}
                onChange={(e) => setPastedUrls(e.target.value)}
                rows={2}
                placeholder={"https://servidor.com/pagina-extra-1.webp\nhttps://servidor.com/pagina-extra-2.webp"}
                className="w-full rounded-none border border-zinc-400 bg-white p-2 text-xs font-mono text-zinc-900"
              />
            </div>
          </div>
        </div>

        {/* Panel animado de progreso si se suben páginas nuevas */}
        {uploadPhase && (
          <UploadProgressPanel
            pages={uploadPages}
            phase={uploadPhase}
            speed={uploadSpeed}
            errorMessage={error}
          />
        )}

        {/* Botones de acción final */}
        <div className="flex flex-wrap items-center justify-between gap-3 border border-zinc-300 bg-white p-4 shadow-2xs">
          <Link
            href={`/leer/${upload.id}`}
            className="border border-zinc-400 bg-zinc-100 px-4 py-2 text-xs font-extrabold text-zinc-800 uppercase hover:bg-zinc-200"
          >
            Cancelar y volver al Lector
          </Link>

          <button
            type="submit"
            disabled={loading}
            className="border border-[#1e40af] bg-[#1d4ed8] px-6 py-2.5 text-xs font-extrabold tracking-wider text-white uppercase hover:bg-[#1e40af] disabled:opacity-50"
          >
            {loading ? "Guardando Cambios..." : "💾 Guardar Cambios del Capítulo"}
          </button>
        </div>
      </form>
    </div>
  );
}

