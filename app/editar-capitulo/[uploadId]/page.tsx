import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { ChapterEditor } from "@/components/manga/ChapterEditor";
import { getCurrentSessionUser } from "@/lib/auth";
import { getScanlationGroups, getUploadById } from "@/lib/data";

async function ChapterEditContent({
  paramsPromise,
}: {
  paramsPromise: Promise<{ uploadId: string }>;
}) {
  const { uploadId } = await paramsPromise;
  const [currentUser, result, scanlations] = await Promise.all([
    getCurrentSessionUser(),
    getUploadById(uploadId),
    getScanlationGroups(),
  ]);

  if (!currentUser) {
    redirect(`/login?callbackUrl=/editar-capitulo/${encodeURIComponent(uploadId)}`);
  }

  if (!result) {
    notFound();
  }

  const { upload, manga } = result;

  // Verificar permisos: ADMIN, Líder del scanlation, o el Uploader que subió el capítulo
  const isLeaderOfScan = currentUser.memberships.some(
    (m) => m.scanlationId === upload.scanlationId && m.role === "SCAN_LEADER"
  );
  const isOwnerUploader = upload.uploaderId === currentUser.id;

  if (currentUser.role !== "ADMIN" && !isLeaderOfScan && !isOwnerUploader) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-12">
        <div className="border-2 border-rose-400 bg-white p-8 text-center shadow-2xs">
          <span className="border border-rose-500 bg-rose-50 px-2.5 py-0.5 text-[10px] font-black text-rose-800 uppercase">
            Acceso Denegado
          </span>
          <h1 className="mt-2 text-lg font-black text-zinc-900 uppercase">
            No tienes permisos para editar este capítulo
          </h1>
          <p className="mt-1 text-xs text-zinc-600">
            Este capítulo pertenece al scanlation <strong>{upload.scanlationName}</strong> y fue publicado por <strong>{upload.uploaderUsername || "otro uploader"}</strong>.
          </p>
          <div className="mt-5 flex justify-center gap-3">
            <Link
              href={`/leer/${upload.id}`}
              className="border border-[#1e40af] bg-[#1d4ed8] px-4 py-2 text-xs font-extrabold text-white uppercase"
            >
              Volver al Lector
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6">
      <ChapterEditor
        upload={upload}
        manga={manga}
        scanlations={scanlations}
      />
    </main>
  );
}

export default function EditarCapituloPage(props: {
  params: Promise<{ uploadId: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-5xl px-4 py-16 text-center text-xs font-bold text-zinc-600">
          Cargando editor de capítulo...
        </div>
      }
    >
      <ChapterEditContent paramsPromise={props.params} />
    </Suspense>
  );
}
