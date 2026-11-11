import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ChapterAccordion } from "@/components/manga/ChapterAccordion";
import { CommentsBox } from "@/components/manga/CommentsBox";
import { StarRatingWidget } from "@/components/manga/StarRatingWidget";
import { UserListButtons } from "@/components/manga/UserListButtons";
import { getCurrentSessionUser } from "@/lib/auth";
import { getMangaBySlug } from "@/lib/data";
import { DEMOGRAPHIES, WORK_STATUSES, WORK_TYPES } from "@/lib/types";

export async function generateMetadata(
  props: PageProps<"/manga/[slug]">
): Promise<Metadata> {
  const { slug } = await props.params;
  const manga = await getMangaBySlug(slug);

  if (!manga) {
    return {
      title: "Obra no encontrada",
      description: "La obra solicitada no existe en la biblioteca.",
    };
  }

  const typeLabel = WORK_TYPES[manga.type]?.label || "Manga";
  const demoLabel = DEMOGRAPHIES[manga.demography]?.label || "General";
  const cleanSynopsis =
    manga.synopsis.slice(0, 155).replace(/\s+/g, " ").trim() + "...";
  const title = `${manga.title} — Leer ${typeLabel} Online en Español`;
  const description = `${manga.title} (${typeLabel} • ${demoLabel}) por ${manga.author}. ${cleanSynopsis}`;

  return {
    title,
    description,
    keywords: [
      manga.title,
      ...manga.altTitles,
      `leer ${manga.title}`,
      `${manga.title} español`,
      `${manga.title} online`,
      typeLabel.toLowerCase(),
      demoLabel.toLowerCase(),
      ...manga.genres,
    ],
    alternates: {
      canonical: `/manga/${encodeURIComponent(manga.slug)}`,
    },
    openGraph: {
      type: "book",
      title,
      description,
      url: `/manga/${encodeURIComponent(manga.slug)}`,
      siteName: "KuraManga",
      images: [
        {
          url: manga.coverUrl,
          alt: `Portada de ${manga.title}`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [manga.coverUrl],
    },
  };
}

async function MangaDetailContent({
  paramsPromise,
}: {
  paramsPromise: Promise<{ slug: string }>;
}) {
  const { slug } = await paramsPromise;
  const [manga, currentUser] = await Promise.all([
    getMangaBySlug(slug),
    getCurrentSessionUser(),
  ]);
  const canUpload = Boolean(currentUser?.canUpload);

  if (!manga) {
    notFound();
  }

  const typeInfo = WORK_TYPES[manga.type];
  const demoInfo = DEMOGRAPHIES[manga.demography];
  const statusInfo = WORK_STATUSES[manga.status];

  const firstUploadId = manga.chapters[0]?.uploads[0]?.id ?? null;
  const lastChapter =
    manga.chapters.length > 0
      ? manga.chapters[manga.chapters.length - 1]
      : null;
  const lastUploadId = lastChapter?.uploads[0]?.id ?? null;

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    "https://kurumanga.dheraldo.workers.dev";

  const jsonLdManga = {
    "@context": "https://schema.org",
    "@type": "ComicSeries",
    name: manga.title,
    alternateName: manga.altTitles,
    description: manga.synopsis,
    image: manga.coverUrl,
    url: `${siteUrl}/manga/${encodeURIComponent(manga.slug)}`,
    genre: manga.genres,
    inLanguage: "es",
    author: {
      "@type": "Person",
      name: manga.author || "Desconocido",
    },
    illustrator: {
      "@type": "Person",
      name: manga.artist || manga.author || "Desconocido",
    },
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: manga.rating.toFixed(1),
      bestRating: "5",
      worstRating: "1",
      ratingCount: Math.max(1, manga.votesCount),
    },
  };

  const jsonLdBreadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Portada",
        item: `${siteUrl}/`,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: typeInfo.label,
        item: `${siteUrl}/biblioteca?type=${manga.type}`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: manga.title,
        item: `${siteUrl}/manga/${encodeURIComponent(manga.slug)}`,
      },
    ],
  };

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdManga) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdBreadcrumb) }}
      />
      {/* Barra de migas de pan clásica */}
      <div className="border border-zinc-300 bg-white px-4 py-2 text-xs font-semibold text-zinc-600 shadow-2xs">
        <Link href="/" className="font-bold text-[#1d4ed8] hover:underline">
          Portada
        </Link>
        <span className="mx-2 text-zinc-400">»</span>
        <Link
          href={`/biblioteca?type=${manga.type}`}
          className="font-bold text-[#1d4ed8] hover:underline"
        >
          {typeInfo.label}
        </Link>
        <span className="mx-2 text-zinc-400">»</span>
        <span className="font-bold text-zinc-900">{manga.title}</span>
      </div>

      {/* Ficha Técnica Clásica (Bordes rectos, fondo blanco) */}
      <section className="border border-zinc-300 bg-white shadow-2xs">
        {/* Encabezado de la ficha */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-zinc-300 bg-zinc-900 px-5 py-3 text-white">
          <div className="flex items-center gap-2">
            <span
              className={`border px-2 py-0.5 text-xs font-extrabold uppercase ${typeInfo.badgeClass}`}
            >
              {typeInfo.label}
            </span>
            <span
              className={`px-2 py-0.5 text-xs font-extrabold uppercase ${demoInfo.colorClass}`}
            >
              {demoInfo.label}
            </span>
            <h1 className="text-lg font-black tracking-tight sm:text-2xl">
              {manga.title}
            </h1>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="border border-amber-400 bg-amber-400 px-2.5 py-0.5 font-black text-zinc-950">
              ★ {manga.rating.toFixed(2)}
            </span>
            <span className="text-zinc-300">({manga.votesCount} votos)</span>
          </div>
        </div>

        {/* Cuerpo de la Ficha */}
        <div className="flex flex-col gap-6 p-5 sm:p-6 md:flex-row md:items-start">
          {/* Columna Izquierda: Portada y Acciones Rápidas */}
          <div className="mx-auto w-56 shrink-0 md:mx-0 md:w-60">
            <div className="border border-zinc-400 bg-zinc-100 p-1 shadow-xs">
              <div className="relative aspect-[2/3] overflow-hidden border border-zinc-300">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={manga.coverUrl}
                  alt={manga.title}
                  className="h-full w-full object-cover"
                />
                <div
                  className={`absolute right-0 bottom-0 left-0 py-1.5 text-center text-xs font-black tracking-widest uppercase ${demoInfo.bgBarClass}`}
                >
                  {demoInfo.label}
                </div>
              </div>
            </div>

            {/* Botones de Lectura Directa */}
            <div className="mt-3 grid grid-cols-2 gap-2">
              {firstUploadId && (
                <Link
                  href={`/leer/${firstUploadId}`}
                  className="border border-[#1e40af] bg-[#1d4ed8] py-2 text-center text-xs font-extrabold text-white uppercase hover:bg-[#1e40af]"
                >
                  ▶ Cap. 1
                </Link>
              )}
              {lastUploadId && (
                <Link
                  href={`/leer/${lastUploadId}`}
                  className="border border-zinc-400 bg-zinc-100 py-2 text-center text-xs font-extrabold text-zinc-900 uppercase hover:bg-zinc-200"
                >
                  ⏭ Último Cap
                </Link>
              )}
            </div>
          </div>

          {/* Columna Derecha: Tabla de Metadatos y Sinopsis */}
          <div className="flex-1 space-y-5">
            {manga.altTitles.length > 0 && (
              <div className="border-b border-zinc-200 pb-2 text-xs text-zinc-600">
                <strong className="text-zinc-800 uppercase">
                  Títulos Alternativos:{" "}
                </strong>
                {manga.altTitles.join(" / ")}
              </div>
            )}

            {/* Tabla de Datos Técnicos estilo MyAnimeList / MangaDex Clásico */}
            <div className="grid grid-cols-1 border border-zinc-300 bg-zinc-50 text-xs sm:grid-cols-2">
              <div className="flex border-b border-zinc-200 p-2.5 sm:border-r">
                <span className="w-28 shrink-0 font-extrabold text-zinc-700 uppercase">
                  Estado:
                </span>
                <span
                  className={`border px-2 py-0.5 text-[11px] font-bold ${statusInfo.badgeClass}`}
                >
                  {statusInfo.label}
                </span>
              </div>
              <div className="flex border-b border-zinc-200 p-2.5">
                <span className="w-28 shrink-0 font-extrabold text-zinc-700 uppercase">
                  Año:
                </span>
                <span className="font-semibold text-zinc-900">
                  {manga.releaseYear}
                </span>
              </div>
              <div className="flex border-b border-zinc-200 p-2.5 sm:border-r sm:border-b-0">
                <span className="w-28 shrink-0 font-extrabold text-zinc-700 uppercase">
                  Autor:
                </span>
                <span className="font-semibold text-zinc-900">
                  {manga.author}
                </span>
              </div>
              <div className="flex p-2.5">
                <span className="w-28 shrink-0 font-extrabold text-zinc-700 uppercase">
                  Arte:
                </span>
                <span className="font-semibold text-zinc-900">
                  {manga.artist}
                </span>
              </div>
            </div>

            {/* Sinopsis */}
            <div className="border border-zinc-300 bg-white p-4">
              <h2 className="border-b border-zinc-200 pb-1.5 text-xs font-black tracking-wider text-zinc-900 uppercase">
                Sinopsis
              </h2>
              <p className="mt-2.5 text-xs leading-relaxed text-zinc-800 sm:text-sm">
                {manga.synopsis}
              </p>
            </div>

            {/* Géneros */}
            <div className="space-y-1.5">
              <span className="block text-xs font-extrabold text-zinc-700 uppercase">
                Géneros y Temáticas:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {manga.genres.map((g) => (
                  <Link
                    key={g}
                    href={`/biblioteca?genre=${encodeURIComponent(g)}`}
                    className="border border-zinc-300 bg-zinc-100 px-2.5 py-1 text-xs font-bold text-zinc-800 hover:border-[#1d4ed8] hover:bg-blue-50 hover:text-[#1d4ed8]"
                  >
                    {g}
                  </Link>
                ))}
              </div>
            </div>

            {/* Botones de Seguimiento del Lector y Valoración */}
            <div className="space-y-4 border-t border-zinc-200 pt-4">
              <div>
                <span className="mb-1.5 block text-xs font-extrabold text-zinc-700 uppercase">
                  Tu Valoración de esta Obra:
                </span>
                <StarRatingWidget
                  mangaId={manga.id}
                  initialRating={manga.rating}
                  initialVotes={manga.votesCount}
                />
              </div>

              {currentUser && (
                <div>
                  <span className="mb-2 block text-xs font-extrabold text-zinc-700 uppercase">
                    Guardar en mi Biblioteca:
                  </span>
                  <UserListButtons
                    manga={{
                      id: manga.id,
                      slug: manga.slug,
                      title: manga.title,
                      coverUrl: manga.coverUrl,
                      type: manga.type,
                      demography: manga.demography,
                      rating: manga.rating,
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Lista de Capítulos y Scanlations */}
      <section className="space-y-3">
        <div className="border border-zinc-300 bg-white px-4 py-3 shadow-2xs">
          <h2 className="text-base font-black tracking-wider text-zinc-900 uppercase">
            📑 Lista de Capítulos ({manga.chapters.length})
          </h2>
          <p className="text-xs text-zinc-500">
            Haz clic en cada capítulo para ver los Scanlations disponibles o
            pulsa «▶ Leer» directamente.
          </p>
        </div>

        <ChapterAccordion
          chapters={manga.chapters}
          mangaId={manga.id}
          mangaSlug={manga.slug}
          canUpload={canUpload}
        />
      </section>

      {/* Comentarios de la Obra */}
      <CommentsBox mangaId={manga.id} comments={manga.comments || []} />
    </main>
  );
}

export default function MangaDetailPage(props: PageProps<"/manga/[slug]">) {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-7xl px-4 py-16 text-center text-sm font-bold text-zinc-600">
          Cargando ficha de la obra...
        </div>
      }
    >
      <MangaDetailContent paramsPromise={props.params} />
    </Suspense>
  );
}
