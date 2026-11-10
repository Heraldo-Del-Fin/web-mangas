import { notFound } from "next/navigation";
import { Suspense } from "react";
import { MangaReader } from "@/components/reader/MangaReader";
import { getLatestUploads, getUploadById } from "@/lib/data";

export async function generateStaticParams() {
  const uploads = await getLatestUploads(50);
  return uploads.map((u) => ({ id: u.id }));
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

  return (
    <MangaReader
      upload={result.upload}
      manga={result.manga}
      prevUploadId={result.prevUploadId}
      nextUploadId={result.nextUploadId}
      allChapterUploads={result.allChapterUploads}
    />
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

