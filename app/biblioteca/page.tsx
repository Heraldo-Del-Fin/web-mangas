import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { LibraryExplorer } from "@/components/manga/LibraryExplorer";
import { getAllMangas } from "@/lib/data";

export const metadata: Metadata = {
  title: "Directorio General de Mangas, Manhwas y Manhuas en Español",
  description:
    "Explora y filtra nuestro catálogo completo de mangas, manhwas, manhuas y novelas en español. Búsqueda avanzada por género, tipo, demografía (Shounen, Seinen, Shoujo, Josei) y estado.",
  alternates: {
    canonical: "/biblioteca",
  },
  openGraph: {
    title: "Directorio de Mangas, Manhwas y Novelas | KuruManga",
    description:
      "Catálogo completo clasificado por demografías, géneros y tipos. Lee online en español.",
    url: "/biblioteca",
  },
};

export default async function BibliotecaPage() {
  const mangas = await getAllMangas();

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border border-zinc-300 bg-white px-5 py-4 shadow-2xs">
        <div>
          <h1 className="text-xl font-black tracking-tight text-zinc-900 uppercase sm:text-2xl">
            📚 Directorio General de Obras
          </h1>
          <p className="mt-0.5 text-xs text-zinc-600">
            Archivo clasificado de Mangas, Manhwas, Manhuas, One Shots y Novelas
            en español.
          </p>
        </div>

        <Link
          href="/subir"
          className="border border-[#1e40af] bg-[#1d4ed8] px-4 py-2 text-xs font-extrabold text-white uppercase hover:bg-[#1e40af]"
        >
          + Registrar Nueva Obra
        </Link>
      </div>

      <Suspense
        fallback={
          <div className="border border-zinc-300 bg-white p-10 text-center text-xs font-bold text-zinc-600">
            Cargando directorio...
          </div>
        }
      >
        <LibraryExplorer initialMangas={mangas} />
      </Suspense>
    </main>
  );
}
