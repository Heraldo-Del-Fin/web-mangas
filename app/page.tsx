import Link from "next/link";
import { MangaCard } from "@/components/manga/MangaCard";
import { ReadingHistoryBar } from "@/components/manga/ReadingHistoryBar";
import { getCurrentSessionUser } from "@/lib/auth";
import {
  getAllMangas,
  getLatestUploads,
  getScanlationGroups,
} from "@/lib/data";
import {
  DEMOGRAPHIES,
  Demography,
  WORK_TYPES,
  WorkType,
} from "@/lib/types";

export default async function HomePage() {
  const [mangas, latestUploads, scanlations, currentUser] = await Promise.all([
    getAllMangas(),
    getLatestUploads(10),
    getScanlationGroups(),
    getCurrentSessionUser(),
  ]);
  const canUpload = Boolean(currentUser?.canUpload);

  const featured = mangas[0];
  const popularMangas = [...mangas]
    .sort((a, b) => b.views - a.views)
    .slice(0, 8);
  const topRated = [...mangas]
    .sort((a, b) => b.rating - a.rating)
    .slice(0, 6);

  const firstChapterUploadId =
    featured?.chapters[0]?.uploads[0]?.id ?? null;

  return (
    <main className="mx-auto max-w-7xl space-y-8 px-4 py-6 sm:px-6">
      {/* CAJA EDITORIAL DESTACADA (Bordes rectos, fondo blanco clásico) */}
      {featured ? (
        <section className="border border-zinc-300 bg-white shadow-2xs">
          {/* Barra de título de caja clásica */}
          <div className="flex items-center justify-between border-b border-zinc-300 bg-zinc-900 px-4 py-2 text-xs font-extrabold tracking-wider text-white uppercase">
            <span>★ OBRA DESTACADA DE LA SEMANA</span>
            <span className="text-amber-400">
              {WORK_TYPES[featured.type].label} •{" "}
              {DEMOGRAPHIES[featured.demography].label}
            </span>
          </div>

          <div className="flex flex-col gap-6 p-5 sm:p-6 md:flex-row md:items-start">
            {/* Póster Rectangular */}
            <Link
              href={`/manga/${featured.slug}`}
              className="mx-auto w-44 shrink-0 border border-zinc-400 bg-zinc-100 shadow-xs transition-opacity hover:opacity-95 md:mx-0 md:w-48"
            >
              <div className="relative aspect-[2/3]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={featured.coverUrl}
                  alt={featured.title}
                  fetchPriority="high"
                  decoding="async"
                  className="h-full w-full object-cover"
                />
                <div
                  className={`absolute right-0 bottom-0 left-0 py-1 text-center text-[10px] font-black tracking-widest uppercase ${
                    DEMOGRAPHIES[featured.demography].bgBarClass
                  }`}
                >
                  {DEMOGRAPHIES[featured.demography].label}
                </div>
              </div>
            </Link>

            {/* Información de Portada */}
            <div className="flex-1 space-y-3.5">
              <div className="flex flex-wrap items-center gap-1.5">
                <span
                  className={`border px-2 py-0.5 text-[11px] font-extrabold uppercase ${
                    WORK_TYPES[featured.type].badgeClass
                  }`}
                >
                  {WORK_TYPES[featured.type].label}
                </span>
                <span
                  className={`px-2 py-0.5 text-[11px] font-extrabold uppercase ${
                    DEMOGRAPHIES[featured.demography].colorClass
                  }`}
                >
                  {DEMOGRAPHIES[featured.demography].label}
                </span>
                <span className="border border-amber-400 bg-amber-50 px-2 py-0.5 text-[11px] font-extrabold text-amber-800">
                  ★ {featured.rating.toFixed(2)} ({featured.votesCount} votos)
                </span>
                <span className="border border-zinc-300 bg-zinc-100 px-2 py-0.5 text-[11px] font-bold text-zinc-700">
                  Autor: {featured.author}
                </span>
              </div>

              <h1 className="text-2xl font-black tracking-tight text-zinc-900 sm:text-3xl">
                <Link
                  href={`/manga/${featured.slug}`}
                  className="hover:text-[#1d4ed8]"
                >
                  {featured.title}
                </Link>
              </h1>

              <p className="line-clamp-3 max-w-3xl text-xs leading-relaxed text-zinc-700 sm:text-sm">
                {featured.synopsis}
              </p>

              <div className="flex flex-wrap gap-1.5 pt-1">
                {featured.genres.map((g) => (
                  <Link
                    key={g}
                    href={`/biblioteca?genre=${encodeURIComponent(g)}`}
                    className="border border-zinc-300 bg-zinc-100 px-2.5 py-0.5 text-xs font-bold text-zinc-700 hover:border-[#1d4ed8] hover:bg-blue-50 hover:text-[#1d4ed8]"
                  >
                    {g}
                  </Link>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-2.5 border-t border-zinc-200 pt-4">
                {firstChapterUploadId && (
                  <Link
                    href={`/leer/${firstChapterUploadId}`}
                    className="border border-[#1e40af] bg-[#1d4ed8] px-4 py-2 text-xs font-extrabold tracking-wide text-white uppercase hover:bg-[#1e40af]"
                  >
                    ▶ Leer Capítulo 1
                  </Link>
                )}
                <Link
                  href={`/manga/${featured.slug}`}
                  className="border border-zinc-400 bg-zinc-100 px-4 py-2 text-xs font-extrabold text-zinc-800 uppercase hover:bg-zinc-200"
                >
                  Ficha y Capítulos ({featured.chapters.length})
                </Link>
                {canUpload && (
                  <Link
                    href="/subir"
                    className="border border-zinc-400 bg-white px-4 py-2 text-xs font-bold text-zinc-700 uppercase hover:bg-zinc-100"
                  >
                    + Subir Obra / Cap
                  </Link>
                )}
              </div>
            </div>
          </div>
        </section>
      ) : (
        <section className="border border-zinc-300 bg-white shadow-2xs">
          <div className="flex items-center justify-between border-b border-zinc-300 bg-zinc-900 px-4 py-2 text-xs font-extrabold tracking-wider text-white uppercase">
            <span>📚 BIENVENIDO A KURAMANGA ARCHIVE</span>
            <span className="text-amber-400">PLATAFORMA EDITORIAL DE LECTURA Y SCANLATION</span>
          </div>
          <div className="p-6 text-center sm:p-8">
            <h1 className="text-xl font-black text-zinc-900 uppercase sm:text-2xl">
              Archivo Editorial Listo para Publicar
            </h1>
            <p className="mx-auto mt-2 max-w-2xl text-xs leading-relaxed text-zinc-600 sm:text-sm">
              La biblioteca se encuentra limpia y lista para producción. Explora el catálogo o inicia sesión con tu cuenta.
            </p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
              {canUpload && (
                <Link
                  href="/subir"
                  className="border border-[#1e40af] bg-[#1d4ed8] px-5 py-2.5 text-xs font-extrabold tracking-wider text-white uppercase hover:bg-[#1e40af]"
                >
                  + Publicar Primera Obra
                </Link>
              )}
              {currentUser ? (
                <Link
                  href="/panel"
                  className="border border-zinc-400 bg-zinc-100 px-5 py-2.5 text-xs font-extrabold text-zinc-900 uppercase hover:bg-zinc-200"
                >
                  Ir al Panel de Gestión
                </Link>
              ) : (
                <>
                  <Link
                    href="/login"
                    className="border border-[#1e40af] bg-[#1d4ed8] px-5 py-2.5 text-xs font-extrabold tracking-wider text-white uppercase hover:bg-[#1e40af]"
                  >
                    Iniciar Sesión
                  </Link>
                  <Link
                    href="/registro"
                    className="border border-zinc-300 bg-white px-5 py-2.5 text-xs font-bold text-zinc-700 uppercase hover:bg-zinc-50"
                  >
                    Crear Cuenta
                  </Link>
                </>
              )}
            </div>
          </div>
        </section>
      )}

      {/* HISTORIAL RECIENTE DE LECTURA ("CONTINUAR LEYENDO") */}
      <ReadingHistoryBar />

      {/* BARRA DE DEMOGRAFÍAS CLÁSICA */}
      <section className="grid grid-cols-2 gap-2.5 sm:grid-cols-5">
        {(Object.keys(DEMOGRAPHIES) as Demography[]).map((demoKey) => {
          const demo = DEMOGRAPHIES[demoKey];
          return (
            <Link
              key={demoKey}
              href={`/biblioteca?demography=${demoKey}`}
              className="group border border-zinc-300 bg-white p-3 shadow-2xs transition hover:border-zinc-900"
            >
              <div
                className={`mb-1.5 inline-block px-2 py-0.5 text-[10px] font-black tracking-wider uppercase ${demo.bgBarClass}`}
              >
                {demo.label}
              </div>
              <p className="line-clamp-1 text-xs font-medium text-zinc-600 group-hover:text-zinc-900">
                {demo.description}
              </p>
            </Link>
          );
        })}
      </section>

      {/* SECCIÓN 2 COLUMNAS: ÚLTIMOS CAPÍTULOS (TABLA CLÁSICA) + SIDEBAR RANKING */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Columna Izquierda (2/3): Tabla Clásica de Últimos Capítulos Subidos */}
        <div className="border border-zinc-300 bg-white shadow-2xs lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-zinc-300 bg-zinc-100 px-4 py-2.5">
            <h2 className="text-sm font-black tracking-wider text-zinc-900 uppercase">
              📄 Últimos Capítulos Publicados
            </h2>
            {canUpload && (
              <Link
                href="/subir?tab=chapter"
                className="border border-zinc-400 bg-white px-2.5 py-1 text-[11px] font-extrabold text-[#1d4ed8] uppercase hover:bg-zinc-50"
              >
                + Publicar Capítulo
              </Link>
            )}
          </div>

          <div className="divide-y divide-zinc-200">
            {latestUploads.length === 0 ? (
              <div className="p-8 text-center text-xs text-zinc-500">
                Aún no se han publicado capítulos.
                {canUpload && (
                  <>
                    {" "}
                    <Link href="/subir" className="font-bold text-[#1d4ed8] hover:underline">
                      Publicar el primero »
                    </Link>
                  </>
                )}
              </div>
            ) : (
              latestUploads.map((up) => (
                <div
                  key={up.id}
                  className="flex items-center justify-between gap-3 px-4 py-3 transition hover:bg-zinc-50"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    {/* Miniatura Rectangular */}
                    <Link
                      href={`/manga/${up.mangaSlug}`}
                      className="relative h-16 w-12 shrink-0 overflow-hidden border border-zinc-300 bg-zinc-100"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={up.mangaCover}
                        alt={up.mangaTitle}
                        loading="lazy"
                        decoding="async"
                        className="h-full w-full object-cover"
                      />
                    </Link>

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span
                          className={`px-1.5 py-0.2 text-[9px] font-extrabold uppercase ${
                            WORK_TYPES[up.mangaType].badgeClass
                          }`}
                        >
                          {WORK_TYPES[up.mangaType].short}
                        </span>
                        <span
                          className={`px-1.5 py-0.2 text-[9px] font-extrabold uppercase ${
                            DEMOGRAPHIES[up.mangaDemography].colorClass
                          }`}
                        >
                          {DEMOGRAPHIES[up.mangaDemography].label}
                        </span>
                        <span className="truncate text-[11px] font-semibold text-zinc-500">
                          [{up.scanlationName}]
                        </span>
                      </div>

                      <Link
                        href={`/manga/${up.mangaSlug}`}
                        className="mt-0.5 block truncate text-sm font-extrabold text-zinc-900 hover:text-[#1d4ed8]"
                      >
                        {up.mangaTitle}
                      </Link>

                      <p className="truncate text-xs text-zinc-600">
                        <strong>Capítulo {up.chapterNumber}</strong> —{" "}
                        {up.chapterTitle}
                      </p>
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <Link
                      href={`/leer/${up.id}`}
                      className="border border-[#1e40af] bg-[#1d4ed8] px-3 py-1 text-xs font-extrabold text-white uppercase hover:bg-[#1e40af]"
                    >
                      Leer Cap. {up.chapterNumber}
                    </Link>
                    <span className="text-[11px] text-zinc-500">
                      {new Date(up.createdAt).toLocaleDateString("es-ES", {
                        day: "2-digit",
                        month: "short",
                      })}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Columna Derecha (1/3): Ranking y Scanlations */}
        <aside className="space-y-6">
          {/* Caja Ranking */}
          <div className="border border-zinc-300 bg-white shadow-2xs">
            <div className="border-b-2 border-zinc-300 bg-zinc-100 px-4 py-2.5">
              <h3 className="text-sm font-black tracking-wider text-zinc-900 uppercase">
                🏆 Ranking Mejor Valorados
              </h3>
            </div>
            <div className="divide-y divide-zinc-200">
              {topRated.length === 0 ? (
                <div className="p-4 text-center text-xs text-zinc-500">
                  Sin obras calificadas todavía.
                </div>
              ) : (
                topRated.map((m, index) => (
                  <Link
                    key={m.id}
                    href={`/manga/${m.slug}`}
                    className="flex items-center gap-3 px-4 py-2.5 transition hover:bg-zinc-50"
                  >
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center border text-xs font-black ${
                        index === 0
                          ? "border-amber-600 bg-amber-400 text-zinc-950"
                          : index === 1
                            ? "border-zinc-400 bg-zinc-200 text-zinc-900"
                            : index === 2
                              ? "border-amber-800 bg-amber-700 text-white"
                              : "border-zinc-300 bg-zinc-100 text-zinc-600"
                      }`}
                    >
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-extrabold text-zinc-900">
                        {m.title}
                      </p>
                      <p className="text-[11px] text-zinc-500">
                        {WORK_TYPES[m.type].label} •{" "}
                        {DEMOGRAPHIES[m.demography].label}
                      </p>
                    </div>
                    <span className="shrink-0 border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-xs font-bold text-amber-800">
                      ★ {m.rating.toFixed(2)}
                    </span>
                  </Link>
                ))
              )}
            </div>
          </div>

          {/* Caja Scanlations */}
          <div className="border border-zinc-300 bg-white shadow-2xs">
            <div className="flex items-center justify-between border-b-2 border-zinc-300 bg-zinc-100 px-4 py-2.5">
              <h3 className="text-sm font-black tracking-wider text-zinc-900 uppercase">
                🛡️ Scanlations Activos
              </h3>
              <Link
                href="/grupos"
                className="text-xs font-bold text-[#1d4ed8] hover:underline"
              >
                Ver todos »
              </Link>
            </div>
            <div className="divide-y divide-zinc-200">
              {scanlations.length === 0 ? (
                <div className="p-4 text-center text-xs text-zinc-500">
                  Sin grupos registrados todavía.
                </div>
              ) : (
                scanlations.map((scan) => (
                  <div
                    key={scan.id}
                    className="flex items-center justify-between px-4 py-2.5"
                  >
                    <div>
                      <p className="text-xs font-extrabold text-zinc-900">
                        {scan.name}{" "}
                        {scan.verified && (
                          <span className="text-[#1d4ed8]" title="Verificado">
                            ✓
                          </span>
                        )}
                      </p>
                      <p className="text-[11px] text-zinc-500">
                        {scan.uploadsCount} capítulos subidos
                      </p>
                    </div>
                    <Link
                      href={`/grupos/${scan.slug}`}
                      className="border border-zinc-300 bg-zinc-100 px-2.5 py-1 text-[11px] font-bold text-zinc-800 hover:bg-zinc-200"
                    >
                      Ver
                    </Link>
                  </div>
                ))
              )}
            </div>
          </div>
        </aside>
      </section>

      {/* CATÁLOGO POPULAR EN CUADRÍCULA CLÁSICA */}
      <section className="border border-zinc-300 bg-white p-5 shadow-2xs">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b-2 border-zinc-300 pb-3">
          <div>
            <h2 className="text-base font-black tracking-wider text-zinc-900 uppercase sm:text-lg">
              📚 Obras Populares en Biblioteca
            </h2>
            <p className="text-xs text-zinc-500">
              Series destacadas por número de lecturas y seguimiento
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {(["MANGA", "MANHWA", "MANHUA"] as WorkType[]).map((t) => (
              <Link
                key={t}
                href={`/biblioteca?type=${t}`}
                className="border border-zinc-300 bg-zinc-100 px-3 py-1 text-xs font-bold text-zinc-800 hover:border-[#1d4ed8] hover:text-[#1d4ed8]"
              >
                {WORK_TYPES[t].label}
              </Link>
            ))}
            <Link
              href="/biblioteca"
              className="border border-[#1e40af] bg-[#1d4ed8] px-3 py-1 text-xs font-extrabold text-white hover:bg-[#1e40af]"
            >
              Directorio Completo »
            </Link>
          </div>
        </div>

        {popularMangas.length === 0 ? (
          <div className="border border-dashed border-zinc-300 bg-zinc-50 p-8 text-center text-xs text-zinc-500">
            No hay obras registradas en el catálogo todavía.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {popularMangas.map((manga) => (
              <MangaCard key={manga.id} manga={manga} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
