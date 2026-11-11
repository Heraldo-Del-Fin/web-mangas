"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { deleteMangaAction, updateMangaAction } from "@/lib/actions";
import {
  ALL_GENRES,
  DEMOGRAPHIES,
  Demography,
  Manga,
  WORK_STATUSES,
  WORK_TYPES,
  WorkStatus,
  WorkType,
} from "@/lib/types";

export function MangaEditor({
  manga,
  isAdmin,
}: {
  manga: Manga;
  isAdmin: boolean;
}) {
  const router = useRouter();

  const [title, setTitle] = useState(manga.title);
  const [altTitles, setAltTitles] = useState(manga.altTitles.join(", "));
  const [synopsis, setSynopsis] = useState(manga.synopsis);
  const [author, setAuthor] = useState(manga.author);
  const [artist, setArtist] = useState(manga.artist);
  const [releaseYear, setReleaseYear] = useState(manga.releaseYear);
  const [type, setType] = useState<WorkType>(manga.type);
  const [demography, setDemography] = useState<Demography>(manga.demography);
  const [status, setStatus] = useState<WorkStatus>(manga.status);
  const [selectedGenres, setSelectedGenres] = useState<string[]>(manga.genres);

  const [coverUrl, setCoverUrl] = useState(manga.coverUrl);
  const [coverPreview, setCoverPreview] = useState<string | null>(manga.coverUrl);
  const [coverFile, setCoverFile] = useState<File | null>(null);

  const [bannerUrl, setBannerUrl] = useState(manga.bannerUrl || "");
  const [bannerFile, setBannerFile] = useState<File | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Estados para eliminación (exclusivo ADMIN)
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const toggleGenre = (genre: string) => {
    setSelectedGenres((prev) =>
      prev.includes(genre) ? prev.filter((g) => g !== genre) : [...prev, genre]
    );
  };

  const handleCoverFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCoverFile(file);
      setCoverPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    const formData = new FormData();
    formData.set("mangaId", manga.id);
    formData.set("title", title);
    formData.set("altTitles", altTitles);
    formData.set("synopsis", synopsis);
    formData.set("author", author);
    formData.set("artist", artist);
    formData.set("releaseYear", String(releaseYear));
    formData.set("type", type);
    formData.set("demography", demography);
    formData.set("status", status);
    formData.set("genres", selectedGenres.join(","));
    formData.set("coverUrl", coverUrl);
    formData.set("bannerUrl", bannerUrl);
    if (coverFile) {
      formData.set("coverFile", coverFile);
    }
    if (bannerFile) {
      formData.set("bannerFile", bannerFile);
    }

    const res = await updateMangaAction(formData);
    setLoading(false);

    if (!res.success) {
      setError(res.error || "Error al actualizar la obra.");
      return;
    }

    setSuccessMsg("✓ La información del manga se ha guardado correctamente.");
    const targetSlug = res.slug || manga.slug;
    setTimeout(() => {
      router.push(`/manga/${encodeURIComponent(targetSlug)}`);
      router.refresh();
    }, 1200);
  };

  const handleDeleteManga = async () => {
    if (!isAdmin) {
      alert("Solo un Administrador general tiene autorización para eliminar obras.");
      return;
    }

    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }

    setDeleting(true);
    setDeleteError(null);

    const res = await deleteMangaAction(manga.id);
    setDeleting(false);

    if (!res.success) {
      setDeleteError(res.error || "No se pudo eliminar el manga.");
      setConfirmDelete(false);
      return;
    }

    // Redirigir a la biblioteca tras eliminar
    router.push("/biblioteca");
    router.refresh();
  };

  return (
    <div className="space-y-6">
      {/* Barra de Navegación y Título */}
      <div className="border border-zinc-300 bg-white p-4 shadow-2xs sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="bg-[#1d4ed8] px-2 py-0.5 text-[10px] font-black text-white uppercase">
                Edición de Obra
              </span>
              <h1 className="text-lg font-black text-zinc-900 uppercase sm:text-xl">
                Editar Información de «{manga.title}»
              </h1>
            </div>
            <p className="mt-1 text-xs text-zinc-600">
              Modifica los metadatos de la ficha técnica, portada, sinopsis y géneros.
              Los cambios se reflejarán inmediatamente en todo el sitio.
            </p>
          </div>

          <Link
            href={`/manga/${encodeURIComponent(manga.slug)}`}
            className="border border-zinc-400 bg-zinc-100 px-4 py-2 text-xs font-bold text-zinc-800 uppercase hover:bg-zinc-200"
          >
            ← Volver a la Ficha
          </Link>
        </div>
      </div>

      {error && (
        <div className="border border-rose-400 bg-rose-50 p-4 text-xs font-bold text-rose-900">
          ⚠️ {error}
        </div>
      )}

      {successMsg && (
        <div className="border border-emerald-400 bg-emerald-50 p-4 text-xs font-bold text-emerald-900">
          {successMsg}
        </div>
      )}

      {/* Formulario Principal de Edición */}
      <form onSubmit={handleSubmit} className="border border-zinc-300 bg-white p-5 shadow-2xs sm:p-6 space-y-6">
        <h2 className="border-b-2 border-zinc-300 pb-2 text-sm font-black text-zinc-900 uppercase">
          1. Información General y Clasificación
        </h2>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Título Principal */}
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-extrabold text-zinc-800 uppercase">
              Título Principal *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-none border border-zinc-400 bg-white px-3 py-2 text-xs font-bold text-zinc-900 focus:border-[#1d4ed8] focus:outline-none"
            />
          </div>

          {/* Títulos Alternativos */}
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-extrabold text-zinc-800 uppercase">
              Títulos Alternativos (separados por coma)
            </label>
            <input
              type="text"
              value={altTitles}
              onChange={(e) => setAltTitles(e.target.value)}
              placeholder="Ej: One Piece, Wan Pīsu, ワンピース"
              className="w-full rounded-none border border-zinc-400 bg-white px-3 py-2 text-xs text-zinc-900 focus:border-[#1d4ed8] focus:outline-none"
            />
          </div>

          {/* Tipo de Obra */}
          <div>
            <label className="mb-1 block text-xs font-extrabold text-zinc-800 uppercase">
              Tipo de Obra *
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as WorkType)}
              className="w-full rounded-none border border-zinc-400 bg-white px-3 py-2 text-xs font-bold text-zinc-900 focus:border-[#1d4ed8]"
            >
              {Object.entries(WORK_TYPES).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </select>
          </div>

          {/* Demografía */}
          <div>
            <label className="mb-1 block text-xs font-extrabold text-zinc-800 uppercase">
              Demografía *
            </label>
            <select
              value={demography}
              onChange={(e) => setDemography(e.target.value as Demography)}
              className="w-full rounded-none border border-zinc-400 bg-white px-3 py-2 text-xs font-bold text-zinc-900 focus:border-[#1d4ed8]"
            >
              {Object.entries(DEMOGRAPHIES).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label} — {v.description}
                </option>
              ))}
            </select>
          </div>

          {/* Estado de Publicación */}
          <div>
            <label className="mb-1 block text-xs font-extrabold text-zinc-800 uppercase">
              Estado de Publicación *
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as WorkStatus)}
              className="w-full rounded-none border border-zinc-400 bg-white px-3 py-2 text-xs font-bold text-zinc-900 focus:border-[#1d4ed8]"
            >
              {Object.entries(WORK_STATUSES).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </select>
          </div>

          {/* Año de Lanzamiento */}
          <div>
            <label className="mb-1 block text-xs font-extrabold text-zinc-800 uppercase">
              Año de Estreno *
            </label>
            <input
              type="number"
              min="1950"
              max="2035"
              value={releaseYear}
              onChange={(e) => setReleaseYear(Number(e.target.value))}
              className="w-full rounded-none border border-zinc-400 bg-white px-3 py-2 text-xs font-bold text-zinc-900 focus:border-[#1d4ed8]"
            />
          </div>

          {/* Autor */}
          <div>
            <label className="mb-1 block text-xs font-extrabold text-zinc-800 uppercase">
              Autor / Guion *
            </label>
            <input
              type="text"
              required
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              className="w-full rounded-none border border-zinc-400 bg-white px-3 py-2 text-xs text-zinc-900 focus:border-[#1d4ed8]"
            />
          </div>

          {/* Arte */}
          <div>
            <label className="mb-1 block text-xs font-extrabold text-zinc-800 uppercase">
              Arte / Ilustrador
            </label>
            <input
              type="text"
              value={artist}
              onChange={(e) => setArtist(e.target.value)}
              className="w-full rounded-none border border-zinc-400 bg-white px-3 py-2 text-xs text-zinc-900 focus:border-[#1d4ed8]"
            />
          </div>

          {/* Sinopsis */}
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-extrabold text-zinc-800 uppercase">
              Sinopsis de la Obra *
            </label>
            <textarea
              required
              rows={5}
              value={synopsis}
              onChange={(e) => setSynopsis(e.target.value)}
              className="w-full rounded-none border border-zinc-400 bg-white p-3 text-xs leading-relaxed text-zinc-900 focus:border-[#1d4ed8] focus:outline-none"
            />
          </div>
        </div>

        {/* Sección 2: Géneros y Etiquetas */}
        <div className="pt-2">
          <h2 className="border-b-2 border-zinc-300 pb-2 text-sm font-black text-zinc-900 uppercase">
            2. Géneros y Temáticas
          </h2>
          <p className="mt-1 text-xs text-zinc-600">
            Haz clic sobre los géneros para seleccionarlos o desmarcarlos ({selectedGenres.length} seleccionados):
          </p>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {ALL_GENRES.map((g) => {
              const active = selectedGenres.includes(g);
              return (
                <button
                  key={g}
                  type="button"
                  onClick={() => toggleGenre(g)}
                  className={`border px-2.5 py-1 text-xs font-bold transition-colors ${
                    active
                      ? "border-[#1e40af] bg-[#1d4ed8] text-white"
                      : "border-zinc-300 bg-zinc-100 text-zinc-700 hover:border-zinc-400"
                  }`}
                >
                  {active ? `✓ ${g}` : `+ ${g}`}
                </button>
              );
            })}
          </div>
        </div>

        {/* Sección 3: Portada y Banner */}
        <div className="pt-2">
          <h2 className="border-b-2 border-zinc-300 pb-2 text-sm font-black text-zinc-900 uppercase">
            3. Portada e Imagen
          </h2>

          <div className="mt-4 grid grid-cols-1 gap-6 md:grid-cols-12">
            {/* Vista previa de la portada actual */}
            <div className="md:col-span-4">
              <span className="mb-1 block text-xs font-extrabold text-zinc-800 uppercase">
                Portada Actual
              </span>
              <div className="mx-auto w-44 border border-zinc-400 bg-zinc-100 p-1 md:mx-0">
                <div className="relative aspect-[2/3] overflow-hidden border border-zinc-300">
                  {coverPreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={coverPreview}
                      alt="Portada"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-zinc-400">
                      Sin Portada
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Opciones para cambiar portada */}
            <div className="md:col-span-8 space-y-4">
              <div>
                <label className="mb-1 block text-xs font-extrabold text-zinc-800 uppercase">
                  Subir Nueva Imagen de Portada (JPG / PNG / WebP)
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleCoverFileChange}
                  className="w-full border border-dashed border-zinc-400 bg-zinc-50 p-3 text-xs font-bold text-zinc-800 file:mr-3 file:border-0 file:bg-[#1d4ed8] file:px-3 file:py-1 file:text-xs file:font-bold file:text-white"
                />
                <span className="mt-1 block text-[11px] text-zinc-500">
                  Si seleccionas un archivo nuevo, se subirá directamente al almacenamiento Cloudflare R2.
                </span>
              </div>

              <div>
                <label className="mb-1 block text-xs font-extrabold text-zinc-800 uppercase">
                  O pegar URL directa de Portada
                </label>
                <input
                  type="url"
                  value={coverUrl}
                  onChange={(e) => {
                    setCoverUrl(e.target.value);
                    if (!coverFile) setCoverPreview(e.target.value);
                  }}
                  placeholder="https://..."
                  className="w-full rounded-none border border-zinc-400 bg-white px-3 py-2 text-xs text-zinc-900 focus:border-[#1d4ed8]"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-extrabold text-zinc-800 uppercase">
                  URL de Banner de Cabecera (Opcional)
                </label>
                <input
                  type="url"
                  value={bannerUrl}
                  onChange={(e) => setBannerUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full rounded-none border border-zinc-400 bg-white px-3 py-2 text-xs text-zinc-900 focus:border-[#1d4ed8]"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Botón de Guardar Cambios */}
        <div className="border-t border-zinc-200 pt-5">
          <button
            type="submit"
            disabled={loading}
            className="w-full border border-[#1e40af] bg-[#1d4ed8] py-3 text-xs font-extrabold tracking-wider text-white uppercase hover:bg-[#1e40af] disabled:opacity-50"
          >
            {loading ? "Guardando Cambios..." : "💾 Guardar Cambios de la Obra"}
          </button>
        </div>
      </form>

      {/* Zona de Peligro / Permisos de Eliminación */}
      <div
        className={`border-2 p-5 shadow-2xs sm:p-6 ${
          isAdmin
            ? "border-rose-400 bg-rose-50/40"
            : "border-zinc-300 bg-zinc-50"
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-300 pb-3">
          <div className="flex items-center gap-2">
            <span
              className={`px-2 py-0.5 text-[10px] font-black uppercase text-white ${
                isAdmin ? "bg-rose-700" : "bg-zinc-600"
              }`}
            >
              {isAdmin ? "Zona Peligrosa (ADMIN)" : "Información de Permisos"}
            </span>
            <h3 className="text-sm font-black text-zinc-900 uppercase">
              Eliminación de la Obra
            </h3>
          </div>

          <span className="text-xs font-bold text-zinc-600">
            Capítulos actuales: {manga.chapters.length}
          </span>
        </div>

        {deleteError && (
          <div className="mt-3 border border-rose-500 bg-rose-100 p-3 text-xs font-bold text-rose-900">
            ⚠️ {deleteError}
          </div>
        )}

        {isAdmin ? (
          <div className="mt-4 space-y-4">
            <p className="text-xs text-zinc-700 leading-relaxed">
              <strong>Advertencia para Administradores:</strong> Al eliminar esta obra se borrarán de forma
              permanente su ficha técnica, <strong>todos los {manga.chapters.length} capítulos publicados</strong>,
              las páginas almacenadas, comentarios y registros de biblioteca de los usuarios.
              Esta acción es <strong>irreversible</strong>.
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleDeleteManga}
                disabled={deleting}
                className={`border px-5 py-2.5 text-xs font-black uppercase transition-colors ${
                  confirmDelete
                    ? "border-rose-700 bg-rose-700 text-white hover:bg-rose-800 animate-pulse"
                    : "border-rose-600 bg-white text-rose-700 hover:bg-rose-50"
                } disabled:opacity-50`}
              >
                {deleting
                  ? "Borrando obra y capítulos..."
                  : confirmDelete
                    ? "⚠️ ¿SEGURO? HAZ CLIC OTRA VEZ PARA ELIMINAR DEFINITIVAMENTE"
                    : "🗑 Eliminar Obra y Todos sus Capítulos"}
              </button>

              {confirmDelete && !deleting && (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="border border-zinc-400 bg-zinc-200 px-4 py-2.5 text-xs font-bold text-zinc-800 uppercase hover:bg-zinc-300"
                >
                  Cancelar
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="mt-3 rounded border border-zinc-300 bg-white p-3 text-xs text-zinc-700">
            ℹ️ <strong>Permiso Restringido:</strong> La eliminación definitiva de mangas completos está reservada
            exclusivamente a los <strong>Administradores generales</strong> para prevenir pérdidas accidentales de
            contenido. Como Scanlation o Uploader, tienes permisos completos para editar y actualizar la información de la obra,
            así como editar o gestionar tus capítulos.
          </div>
        )}
      </div>
    </div>
  );
}

