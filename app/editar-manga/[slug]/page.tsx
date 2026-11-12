import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { MangaEditor } from "@/components/manga/MangaEditor";
import { getCurrentSessionUser } from "@/lib/auth";
import { getMangaBySlug } from "@/lib/data";

interface EditarMangaPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata(
  props: EditarMangaPageProps
): Promise<Metadata> {
  const { slug } = await props.params;
  const manga = await getMangaBySlug(slug);

  if (!manga) {
    return {
      title: "Obra no encontrada",
    };
  }

  return {
    title: `Editar ${manga.title}`,
    robots: {
      index: false,
      follow: false,
    },
  };
}

async function MangaEditContent({
  paramsPromise,
}: {
  paramsPromise: Promise<{ slug: string }>;
}) {
  const { slug } = await paramsPromise;
  const [currentUser, manga] = await Promise.all([
    getCurrentSessionUser(),
    getMangaBySlug(slug),
  ]);

  if (!currentUser) {
    redirect(`/login?callbackUrl=/editar-manga/${encodeURIComponent(slug)}`);
  }

  if (!manga) {
    notFound();
  }

  if (!currentUser.canUpload) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-12">
        <div className="border-2 border-rose-400 bg-white p-8 text-center shadow-2xs">
          <span className="border border-rose-500 bg-rose-50 px-2.5 py-0.5 text-[10px] font-black text-rose-800 uppercase">
            Acceso Denegado
          </span>
          <h1 className="mt-2 text-lg font-black text-zinc-900 uppercase">
            No tienes permisos para editar obras
          </h1>
          <p className="mt-1 text-xs text-zinc-600">
            Necesitas una cuenta autorizada como <strong>Uploader</strong>,{" "}
            <strong>miembro de Scanlation</strong> o <strong>Administrador</strong> para modificar información de mangas.
          </p>
          <div className="mt-5 flex justify-center gap-3">
            <Link
              href={`/manga/${encodeURIComponent(manga.slug)}`}
              className="border border-[#1e40af] bg-[#1d4ed8] px-4 py-2 text-xs font-extrabold text-white uppercase"
            >
              Volver a la Obra
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const isAdmin = currentUser.role === "ADMIN";

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6">
      <MangaEditor manga={manga} isAdmin={isAdmin} />
    </main>
  );
}

export default function EditarMangaPage(props: EditarMangaPageProps) {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-5xl px-4 py-16 text-center text-xs font-bold text-zinc-600">
          Cargando editor de obra...
        </div>
      }
    >
      <MangaEditContent paramsPromise={props.params} />
    </Suspense>
  );
}

