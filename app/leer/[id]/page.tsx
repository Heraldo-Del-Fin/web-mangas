import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { MangaReader } from "@/components/reader/MangaReader";
import { getUploadById } from "@/lib/data";

export async function generateMetadata(
  props: PageProps<"/leer/[id]">
): Promise<Metadata> {
  const { id } = await props.params;
  const result = await getUploadById(id);

  if (!result) {
    return {
      title: "Capítulo no encontrado",
      description: "El capítulo solicitado no existe en la biblioteca.",
    };
  }

  const { upload, manga } = result;
  const title = `Capítulo ${upload.chapterNumber}${
    upload.chapterTitle ? `: ${upload.chapterTitle}` : ""
  } — ${manga.title} en Español`;
  const description = `Lee online el capítulo ${upload.chapterNumber} de ${
    manga.title
  } en español traducido por ${upload.scanlationName}. ${
    upload.pages.length
  } páginas en lector cascada y paginado.`;

  return {
    title,
    description,
    keywords: [
      manga.title,
      `capitulo ${upload.chapterNumber} ${manga.title}`,
      `leer ${manga.title} cap ${upload.chapterNumber}`,
      upload.scanlationName,
      "manga online",
      "leer en español",
    ],
    alternates: {
      canonical: `/leer/${encodeURIComponent(upload.id)}`,
    },
    openGraph: {
      type: "article",
      title,
      description,
      url: `/leer/${encodeURIComponent(upload.id)}`,
      siteName: "KuraManga",
      images: [
        {
          url: upload.pages[0] || manga.coverUrl,
          alt: `Página 1 de ${manga.title} Capítulo ${upload.chapterNumber}`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [upload.pages[0] || manga.coverUrl],
    },
  };
}

async function ReaderContent({
  paramsPromise,
}: {
  paramsPromise: Promise<{ id: string }>;
}) {
  const { id } = await paramsPromise;
  const result = await getUploadById(id);

  if (!result) {
    notFound();
  }

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    "https://kurumanga.dheraldo.workers.dev";

  const jsonLdChapter = {
    "@context": "https://schema.org",
    "@type": "ComicIssue",
    name: `Capítulo ${result.upload.chapterNumber}: ${result.upload.chapterTitle}`,
    issueNumber: String(result.upload.chapterNumber),
    partOfSeries: {
      "@type": "ComicSeries",
      name: result.manga.title,
      url: `${siteUrl}/manga/${encodeURIComponent(result.manga.slug)}`,
    },
    inLanguage: "es",
    numberOfPages: result.upload.pages.length,
    image: result.upload.pages[0] || result.manga.coverUrl,
    publisher: {
      "@type": "Organization",
      name: result.upload.scanlationName,
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
        name: result.manga.title,
        item: `${siteUrl}/manga/${encodeURIComponent(result.manga.slug)}`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: `Capítulo ${result.upload.chapterNumber}`,
        item: `${siteUrl}/leer/${encodeURIComponent(result.upload.id)}`,
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdChapter) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdBreadcrumb) }}
      />
      <MangaReader
        upload={result.upload}
        manga={result.manga}
        prevUploadId={result.prevUploadId}
        nextUploadId={result.nextUploadId}
        allChapterUploads={result.allChapterUploads}
      />
    </>
  );
}

export default function ReaderPage(props: PageProps<"/leer/[id]">) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#f4f5f7] text-sm font-bold text-zinc-700">
          Cargando lector de capítulo...
        </div>
      }
    >
      <ReaderContent paramsPromise={props.params} />
    </Suspense>
  );
}
