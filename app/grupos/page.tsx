import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentSessionUser } from "@/lib/auth";
import { getLatestUploads, getScanlationGroups } from "@/lib/data";

export const metadata: Metadata = {
  title: "Directorio de Scanlations y Grupos de Traducción",
  description:
    "Descubre los grupos de scanlation que traducen y editan mangas, manhwas y manhuas al español en KuruManga. Conoce sus proyectos, miembros y últimos aportes.",
  alternates: {
    canonical: "/grupos",
  },
  openGraph: {
    title: "Scanlations y Grupos de Traducción | KuruManga",
    description:
      "Equipos editoriales de traducción al español en KuruManga.",
    url: "/grupos",
  },
};

export default async function GruposPage() {
  const [scanlations, latestUploads, currentUser] = await Promise.all([
    getScanlationGroups(),
    getLatestUploads(30),
    getCurrentSessionUser(),
  ]);
  const canUpload = Boolean(currentUser?.canUpload);

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border border-zinc-300 bg-white px-5 py-4 shadow-2xs">
        <div>
          <h1 className="text-xl font-black tracking-tight text-zinc-900 uppercase sm:text-2xl">
            🛡️ Directorio de Grupos / Scanlations
          </h1>
          <p className="mt-0.5 text-xs text-zinc-600">
            Equipos de traducción y edición registrados en KuruManga.
          </p>
        </div>

        {canUpload && (
          <Link
            href="/subir?tab=chapter"
            className="border border-[#1e40af] bg-[#1d4ed8] px-4 py-2 text-xs font-extrabold text-white uppercase hover:bg-[#1e40af]"
          >
            + Publicar Capítulo con mi Grupo
          </Link>
        )}
      </div>

      {scanlations.length === 0 ? (
        <div className="border border-zinc-300 bg-white p-10 text-center shadow-2xs">
          <p className="text-sm font-black text-zinc-900 uppercase">
            Aún no hay grupos Scanlation registrados
          </p>
          <p className="mt-1 text-xs text-zinc-600">
            Solicita la creación de tu Scanlation desde el panel de cuenta o
            publica el primer capítulo como Administrador.
          </p>
          <div className="mt-4 flex justify-center gap-3">
            <Link
              href="/panel"
              className="border border-[#1e40af] bg-[#1d4ed8] px-4 py-2 text-xs font-extrabold text-white uppercase hover:bg-[#1e40af]"
            >
              Crear / Solicitar Scanlation »
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {scanlations.map((group) => {
            const groupUploads = latestUploads
              .filter((u) => u.scanlationId === group.id)
              .slice(0, 3);

            return (
              <div
                key={group.id}
                className="flex flex-col justify-between border border-zinc-300 bg-white shadow-2xs"
              >
                <div>
                  <div className="flex items-center justify-between border-b-2 border-zinc-300 bg-zinc-100 px-4 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 items-center justify-center border border-zinc-800 bg-zinc-900 text-xs font-black text-white">
                        {group.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <Link
                          href={`/grupos/${group.slug}`}
                          className="text-sm font-black text-zinc-900 uppercase hover:text-[#1d4ed8]"
                        >
                          {group.name}{" "}
                          {group.verified && (
                            <span className="text-[#1d4ed8]">✓</span>
                          )}
                        </Link>
                      </div>
                    </div>
                    <span className="border border-zinc-300 bg-white px-2 py-0.5 text-[11px] font-bold text-zinc-700">
                      {group.uploadsCount} capítulos
                    </span>
                  </div>

                  <div className="p-4">
                    <p className="text-xs leading-relaxed text-zinc-700">
                      {group.description}
                    </p>

                    {groupUploads.length > 0 && (
                      <div className="mt-4 border-t border-zinc-200 pt-3">
                        <p className="mb-2 text-[11px] font-extrabold text-zinc-700 uppercase">
                          Últimos aportes del grupo:
                        </p>
                        <div className="divide-y divide-zinc-200 border border-zinc-300 bg-zinc-50">
                          {groupUploads.map((up) => (
                            <div
                              key={up.id}
                              className="flex items-center justify-between px-3 py-1.5 text-xs"
                            >
                              <Link
                                href={`/manga/${up.mangaSlug}`}
                                className="truncate font-bold text-zinc-900 hover:text-[#1d4ed8]"
                              >
                                {up.mangaTitle} — Cap. {up.chapterNumber}
                              </Link>
                              <Link
                                href={`/leer/${up.id}`}
                                className="shrink-0 font-extrabold text-[#1d4ed8] hover:underline"
                              >
                                ▶ Leer
                              </Link>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-zinc-200 bg-zinc-50 px-4 py-2 text-xs text-zinc-600">
                  <span>👥 {group.membersCount} miembros</span>
                  <div className="flex items-center gap-3">
                    <Link
                      href={`/grupos/${group.slug}`}
                      className="font-extrabold text-zinc-800 hover:underline"
                    >
                      Ver Ficha Completa
                    </Link>
                    {canUpload && (
                      <Link
                        href="/subir?tab=chapter"
                        className="font-extrabold text-[#1d4ed8] hover:underline"
                      >
                        Subir capítulo »
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
