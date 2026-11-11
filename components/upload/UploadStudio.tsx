"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";
import { createMangaAction, uploadChapterAction } from "@/lib/actions";
import {
  ALL_GENRES,
  DEMOGRAPHIES,
  Demography,
  Manga,
  ScanlationGroup,
  WORK_STATUSES,
  WORK_TYPES,
  WorkStatus,
  WorkType,
} from "@/lib/types";

export function UploadStudio({
  mangas,
  scanlations,
}: {
  mangas: Manga[];
  scanlations: ScanlationGroup[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab =
    searchParams.get("tab") === "chapter" ? "chapter" : "manga";
  const initialMangaId = searchParams.get("mangaId") || mangas[0]?.id || "";

  const [tab, setTab] = useState<"manga" | "chapter">(initialTab);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedGenres, setSelectedGenres] = useState<string[]>([
    "Acción",
    "Fantasía",
  ]);
  const [selectedType, setSelectedType] = useState<WorkType>("MANGA");
  const [selectedDemo, setSelectedDemo] = useState<Demography>("SHOUNEN");
  const [selectedStatus, setSelectedStatus] =
    useState<WorkStatus>("EN_PUBLICACION");
  const [coverPreview, setCoverPreview] = useState<string | null>(null);

  const [selectedMangaId, setSelectedMangaId] = useState<string>(initialMangaId);
  const [pageFiles, setPageFiles] = useState<File[]>([]);
  const [useCustomScan, setUseCustomScan] = useState(scanlations.length === 0);

  const toggleGenre = (genre: string) => {
    setSelectedGenres((prev) =>
      prev.includes(genre) ? prev.filter((g) => g !== genre) : [...prev, genre]
    );
  };

  const handleMangaSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    formData.set("genres", selectedGenres.join(","));
    formData.set("type", selectedType);
    formData.set("demography", selectedDemo);
    formData.set("status", selectedStatus);

    const res = await createMangaAction(formData);
    setLoading(false);

    if (!res.success) {
      setError(res.error || "No se pudo crear la obra.");
      return;
    }

    router.push(`/manga/${res.slug}`);
    router.refresh();
  };

  const handleChapterSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    formData.delete("pageFiles");
    for (const file of pageFiles) {
      formData.append("pageFiles", file);
    }

    const res = await uploadChapterAction(formData);
    setLoading(false);

    if (!res.success) {
      setError(res.error || "No se pudo subir el capítulo.");
      return;
    }

    if (res.uploadId) {
      router.push(`/leer/${res.uploadId}`);
      router.refresh();
    } else if (res.mangaSlug) {
      router.push(`/manga/${res.mangaSlug}`);
      router.refresh();
    }
  };

  const movePageFile = (index: number, direction: -1 | 1) => {
    setPageFiles((prev) => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      const temp = next[index];
      next[index] = next[target];
      next[target] = temp;
      return next;
    });
  };

  const removePageFile = (index: number) => {
    setPageFiles((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-5">
      {/* Pestañas Rectas Clásicas */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => {
            setTab("manga");
            setError(null);
          }}
          className={`flex items-center gap-3 border p-4 text-left transition ${
            tab === "manga"
              ? "border-[#1d4ed8] bg-blue-50/70"
              : "border-zinc-300 bg-white hover:bg-zinc-50"
          }`}
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center border border-zinc-400 bg-white text-lg font-black">
            1
          </div>
          <div>
            <h2 className="text-sm font-black text-zinc-900 uppercase">
              Registrar Nueva Obra
            </h2>
            <p className="text-xs text-zinc-600">
              Crea la ficha de un Manga, Manhwa, Manhua o Novela.
            </p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => {
            setTab("chapter");
            setError(null);
          }}
          className={`flex items-center gap-3 border p-4 text-left transition ${
            tab === "chapter"
              ? "border-[#1d4ed8] bg-blue-50/70"
              : "border-zinc-300 bg-white hover:bg-zinc-50"
          }`}
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center border border-zinc-400 bg-white text-lg font-black">
            2
          </div>
          <div>
            <h2 className="text-sm font-black text-zinc-900 uppercase">
              Subir Capítulo (Scanlation)
            </h2>
            <p className="text-xs text-zinc-600">
              Sube las páginas ordenadas de un capítulo a una obra.
            </p>
          </div>
        </button>
      </div>

      {error && (
        <div className="border border-rose-500 bg-rose-50 p-3.5 text-xs font-bold text-rose-800">
          ⚠️ {error}
        </div>
      )}

      {/* TAB 1: CREAR NUEVA OBRA */}
      {tab === "manga" ? (
        <form
          onSubmit={handleMangaSubmit}
          className="space-y-6 border border-zinc-300 bg-white p-5 shadow-2xs sm:p-6"
        >
          <div className="border-b-2 border-zinc-300 pb-3">
            <h3 className="text-base font-black text-zinc-900 uppercase">
              Ficha Técnica de Nueva Obra
            </h3>
            <p className="text-xs text-zinc-600">
              Si no dispones de imagen de portada, el sistema generará un póster
              automáticamente.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Columna Izquierda: Portada */}
            <div className="space-y-4">
              <label className="block text-xs font-extrabold text-zinc-800 uppercase">
                Portada (Proporción 2:3)
              </label>

              <div className="relative flex aspect-[2/3] w-full flex-col items-center justify-center overflow-hidden border-2 border-dashed border-zinc-400 bg-zinc-50 p-4 text-center">
                {coverPreview ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={coverPreview}
                      alt="Vista previa de portada"
                      className="h-full w-full object-cover"
                    />
                    <div
                      className={`absolute right-0 bottom-0 left-0 py-1.5 text-center text-xs font-black tracking-widest uppercase ${DEMOGRAPHIES[selectedDemo].bgBarClass}`}
                    >
                      {DEMOGRAPHIES[selectedDemo].label}
                    </div>
                  </>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs font-bold text-zinc-700">
                      Sin imagen seleccionada (se autogenerará portada)
                    </p>
                    <span
                      className={`inline-block px-2.5 py-0.5 text-[10px] font-black uppercase ${DEMOGRAPHIES[selectedDemo].bgBarClass}`}
                    >
                      Demografía: {DEMOGRAPHIES[selectedDemo].label}
                    </span>
                  </div>
                )}
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-zinc-700">
                  Subir archivo (.jpg, .png, .webp)
                </label>
                <input
                  type="file"
                  name="coverFile"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setCoverPreview(URL.createObjectURL(file));
                    } else {
                      setCoverPreview(null);
                    }
                  }}
                  className="w-full border border-zinc-400 bg-zinc-50 p-1.5 text-xs text-zinc-800"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-zinc-700">
                  O pegar URL de imagen externa
                </label>
                <input
                  type="url"
                  name="coverUrl"
                  placeholder="https://ejemplo.com/portada.jpg"
                  onChange={(e) => {
                    if (e.target.value.trim()) {
                      setCoverPreview(e.target.value.trim());
                    }
                  }}
                  className="w-full rounded-none border border-zinc-400 bg-white px-3 py-1.5 text-xs text-zinc-900 focus:border-[#1d4ed8] focus:outline-none"
                />
              </div>
            </div>

            {/* Columna Derecha: Campos */}
            <div className="space-y-4 lg:col-span-2">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-extrabold text-zinc-800 uppercase">
                    Título Principal *
                  </label>
                  <input
                    type="text"
                    name="title"
                    required
                    placeholder="Ej: Solo Leveling: Ragnarok"
                    className="w-full rounded-none border border-zinc-400 bg-white px-3 py-2 text-sm font-bold text-zinc-900 focus:border-[#1d4ed8] focus:outline-none"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-extrabold text-zinc-800 uppercase">
                    Títulos Alternativos (separados por coma)
                  </label>
                  <input
                    type="text"
                    name="altTitles"
                    placeholder="Ej: 나 혼자만 레벨업, Only I Level Up"
                    className="w-full rounded-none border border-zinc-400 bg-white px-3 py-1.5 text-xs text-zinc-900 focus:border-[#1d4ed8] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-extrabold text-zinc-800 uppercase">
                    Autor
                  </label>
                  <input
                    type="text"
                    name="author"
                    placeholder="Ej: Chugong"
                    className="w-full rounded-none border border-zinc-400 bg-white px-3 py-1.5 text-xs text-zinc-900 focus:border-[#1d4ed8] focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="mb-1 block text-xs font-extrabold text-zinc-800 uppercase">
                      Artista
                    </label>
                    <input
                      type="text"
                      name="artist"
                      placeholder="Ej: Dubu"
                      className="w-full rounded-none border border-zinc-400 bg-white px-3 py-1.5 text-xs text-zinc-900 focus:border-[#1d4ed8] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-extrabold text-zinc-800 uppercase">
                      Año
                    </label>
                    <input
                      type="number"
                      name="releaseYear"
                      defaultValue={2026}
                      min={1950}
                      max={2030}
                      className="w-full rounded-none border border-zinc-400 bg-white px-3 py-1.5 text-xs text-zinc-900 focus:border-[#1d4ed8] focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs font-extrabold text-zinc-800 uppercase">
                    Tipo de Obra
                  </label>
                  <select
                    value={selectedType}
                    onChange={(e) => setSelectedType(e.target.value as WorkType)}
                    className="w-full rounded-none border border-zinc-400 bg-white px-3 py-2 text-xs font-bold text-zinc-900"
                  >
                    {(Object.keys(WORK_TYPES) as WorkType[]).map((t) => (
                      <option key={t} value={t}>
                        {WORK_TYPES[t].label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-extrabold text-zinc-800 uppercase">
                    Demografía
                  </label>
                  <select
                    value={selectedDemo}
                    onChange={(e) =>
                      setSelectedDemo(e.target.value as Demography)
                    }
                    className="w-full rounded-none border border-zinc-400 bg-white px-3 py-2 text-xs font-bold text-zinc-900"
                  >
                    {(Object.keys(DEMOGRAPHIES) as Demography[]).map((d) => (
                      <option key={d} value={d}>
                        {DEMOGRAPHIES[d].label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-extrabold text-zinc-800 uppercase">
                    Estado
                  </label>
                  <select
                    value={selectedStatus}
                    onChange={(e) =>
                      setSelectedStatus(e.target.value as WorkStatus)
                    }
                    className="w-full rounded-none border border-zinc-400 bg-white px-3 py-2 text-xs font-bold text-zinc-900"
                  >
                    {(Object.keys(WORK_STATUSES) as WorkStatus[]).map((s) => (
                      <option key={s} value={s}>
                        {WORK_STATUSES[s].label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-extrabold text-zinc-800 uppercase">
                  Sinopsis *
                </label>
                <textarea
                  name="synopsis"
                  required
                  rows={4}
                  placeholder="Resumen argumental de la obra..."
                  className="w-full rounded-none border border-zinc-400 bg-white p-3 text-xs text-zinc-900 focus:border-[#1d4ed8] focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-extrabold text-zinc-800 uppercase">
                  Géneros ({selectedGenres.length} seleccionados)
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {ALL_GENRES.map((genre) => {
                    const active = selectedGenres.includes(genre);
                    return (
                      <button
                        key={genre}
                        type="button"
                        onClick={() => toggleGenre(genre)}
                        className={`border px-2.5 py-1 text-xs font-bold transition ${
                          active
                            ? "border-[#1e40af] bg-[#1d4ed8] text-white"
                            : "border-zinc-300 bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                        }`}
                      >
                        {genre}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full border border-[#1e40af] bg-[#1d4ed8] py-2.5 text-xs font-extrabold tracking-wider text-white uppercase hover:bg-[#1e40af] disabled:opacity-50"
                >
                  {loading
                    ? "Guardando obra en el archivo..."
                    : "Guardar y Publicar Ficha de Obra"}
                </button>
              </div>
            </div>
          </div>
        </form>
      ) : (
        /* TAB 2: SUBIR CAPÍTULO */
        <form
          onSubmit={handleChapterSubmit}
          className="space-y-5 border border-zinc-300 bg-white p-5 shadow-2xs sm:p-6"
        >
          <div className="border-b-2 border-zinc-300 pb-3">
            <h3 className="text-base font-black text-zinc-900 uppercase">
              Publicación de Capítulo
            </h3>
            <p className="text-xs text-zinc-600">
              Selecciona la obra, asigna el número de capítulo y sube las
              páginas en orden.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="mb-1 block text-xs font-extrabold text-zinc-800 uppercase">
                Obra *
              </label>
              <select
                name="mangaId"
                value={selectedMangaId}
                onChange={(e) => setSelectedMangaId(e.target.value)}
                required
                className="w-full rounded-none border border-zinc-400 bg-white px-3 py-2 text-xs font-bold text-zinc-900"
              >
                {mangas.map((m) => (
                  <option key={m.id} value={m.id}>
                    [{WORK_TYPES[m.type].short}] {m.title} ({m.chapters.length}{" "}
                    caps)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-extrabold text-zinc-800 uppercase">
                Número de Capítulo *
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                name="chapterNumber"
                defaultValue={
                  (mangas.find((m) => m.id === selectedMangaId)?.chapters
                    .length ?? 0) + 1
                }
                required
                className="w-full rounded-none border border-zinc-400 bg-white px-3 py-2 text-xs font-bold text-zinc-900"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-extrabold text-zinc-800 uppercase">
                Título del Capítulo
              </label>
              <input
                type="text"
                name="chapterTitle"
                placeholder="Ej: El despertar"
                className="w-full rounded-none border border-zinc-400 bg-white px-3 py-2 text-xs text-zinc-900"
              />
            </div>

            <div className="md:col-span-2">
              <div className="mb-1 flex items-center justify-between">
                <label className="text-xs font-extrabold text-zinc-800 uppercase">
                  Scanlation / Grupo
                </label>
                <button
                  type="button"
                  onClick={() => setUseCustomScan((v) => !v)}
                  className="text-xs font-bold text-[#1d4ed8] hover:underline"
                >
                  {useCustomScan
                    ? "Elegir grupo existente"
                    : "+ Escribir nuevo Scanlation"}
                </button>
              </div>

              {useCustomScan ? (
                <input
                  type="text"
                  name="customScanName"
                  placeholder="Nombre de tu Scanlation..."
                  className="w-full rounded-none border border-zinc-400 bg-white px-3 py-2 text-xs font-bold text-zinc-900"
                />
              ) : (
                <select
                  name="scanlationId"
                  className="w-full rounded-none border border-zinc-400 bg-white px-3 py-2 text-xs font-bold text-zinc-900"
                >
                  {scanlations.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} {s.verified ? "✓" : ""}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <label className="block text-xs font-extrabold text-zinc-800 uppercase">
              Archivos de Páginas (.jpg, .png, .webp)
            </label>

            <div className="border-2 border-dashed border-zinc-400 bg-zinc-50 p-6 text-center hover:border-[#1d4ed8]">
              <input
                id="chapter-pages-input"
                type="file"
                multiple
                accept="image/*"
                onChange={(e) => {
                  const files = Array.from(e.target.files || []);
                  if (files.length > 0) {
                    setPageFiles((prev) => [...prev, ...files]);
                  }
                }}
                className="hidden"
              />
              <label
                htmlFor="chapter-pages-input"
                className="block cursor-pointer space-y-1"
              >
                <p className="text-xs font-extrabold text-[#1d4ed8] uppercase">
                  [ Seleccionar imágenes desde tu equipo ]
                </p>
                <p className="text-[11px] text-zinc-600">
                  Las páginas seleccionadas se subirán directamente a tu bucket Cloudflare R2 en orden numérico.
                </p>
              </label>
            </div>

            {pageFiles.length > 0 && (
              <div className="border border-zinc-300 bg-zinc-50 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-extrabold text-zinc-900">
                    {pageFiles.length} páginas seleccionadas
                  </span>
                  <button
                    type="button"
                    onClick={() => setPageFiles([])}
                    className="text-xs font-bold text-rose-700 hover:underline"
                  >
                    Vaciar lista
                  </button>
                </div>
                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                  {pageFiles.map((file, idx) => (
                    <div
                      key={`${file.name}-${idx}`}
                      className="flex items-center justify-between border border-zinc-300 bg-white px-2.5 py-1.5 text-xs"
                    >
                      <span className="truncate font-semibold text-zinc-800">
                        <strong>Pág. {idx + 1}:</strong> {file.name}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => movePageFile(idx, -1)}
                          className="border border-zinc-300 bg-zinc-100 px-1.5 py-0.5 text-zinc-800"
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          onClick={() => movePageFile(idx, 1)}
                          className="border border-zinc-300 bg-zinc-100 px-1.5 py-0.5 text-zinc-800"
                        >
                          ↓
                        </button>
                        <button
                          type="button"
                          onClick={() => removePageFile(idx)}
                          className="border border-rose-300 bg-rose-50 px-1.5 py-0.5 text-rose-700"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="mb-1 block text-xs font-bold text-zinc-700">
                O pegar URLs externas (una por línea, opcional)
              </label>
              <textarea
                name="pageUrls"
                rows={3}
                placeholder={"https://servidor.com/pagina-1.webp\nhttps://servidor.com/pagina-2.webp"}
                className="w-full rounded-none border border-zinc-400 bg-white p-2.5 font-mono text-xs text-zinc-900"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full border border-[#1e40af] bg-[#1d4ed8] py-2.5 text-xs font-extrabold tracking-wider text-white uppercase hover:bg-[#1e40af] disabled:opacity-50"
          >
            {loading
              ? "Publicando capítulo..."
              : "Publicar Capítulo y Abrir en el Lector »"}
          </button>
        </form>
      )}
    </div>
  );
}
