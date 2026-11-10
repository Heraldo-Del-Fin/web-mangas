import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { MangaCard } from "@/components/manga/MangaCard";
import {
  getScanlationBySlug,
  getScanlationGroups,
  readDatabase,
} from "@/lib/data";

export async function generateStaticParams() {
  const groups = await getScanlationGroups();
  return groups.map((g) => ({ slug: g.slug }));
}

async function ScanlationDetailContent({
  paramsPromise,
}: {
  paramsPromise: Promise<{ slug: string }>;
}) {
  const { slug } = await paramsPromise;
  const [data, db] = await Promise.all([
    getScanlationBySlug(slug),
    readDatabase(),
  ]);

  if (!data) {
    notFound();
  }

  const { group, uploads, mangas } = data;
  const groupMembers = db.scanlationMembers.filter(
    (m) => m.scanlationId === group.id
  );

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">
      {/* Migas de pan */}
      <div className="border border-zinc-300 bg-white px-4 py-2 text-xs font-semibold text-zinc-600 shadow-2xs">
        <Link href="/" className="font-bold text-[#1d4ed8] hover:underline">
          Portada
        </Link>
        <span className="mx-2 text-zinc-400">»</span>
        <Link
          href="/grupos"
          className="font-bold text-[#1d4ed8] hover:underline"
        >
          Scanlations
        </Link>
        <span className="mx-2 text-zinc-400">»</span>
        <span className="font-bold text-zinc-900">{group.name}</span>
      </div>

      {/* Cabecera del Scanlation */}
      <section className="border border-zinc-300 bg-white shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-zinc-300 bg-zinc-900 px-5 py-3 text-white">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center border border-zinc-500 bg-[#1d4ed8] text-xs font-black text-white">
              {group.name.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-black tracking-tight uppercase sm:text-xl">
                  {group.name}
                </h1>
                {group.verified && (
                  <span className="bg-emerald-600 px-2 py-0.5 text-[10px] font-black text-white uppercase">
                    ✓ Scanlation Verificado
                  </span>
                )}
              </div>
            </div>
          </div>

          <Link
            href="/subir?tab=chapter"
            className="border border-[#1e40af] bg-[#1d4ed8] px-3.5 py-1.5 text-xs font-extrabold text-white uppercase hover:bg-[#1e40af]"
          >
            + Publicar Capítulo con este Grupo
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-6 p-5 md:grid-cols-3">
          <div className="space-y-3 md:col-span-2">
            <h2 className="text-xs font-black tracking-wider text-zinc-800 uppercase">
              Sobre el Grupo Traductor
            </h2>
            <p className="text-xs leading-relaxed text-zinc-700 sm:text-sm">
              {group.description}
            </p>

            {/* Equipo Autorizado en este Scanlation */}
            <div className="pt-2">
              <h3 className="mb-2 text-xs font-black tracking-wider text-zinc-800 uppercase">
                Equipo Autorizado en Plataforma ({groupMembers.length}):
              </h3>
              {groupMembers.length === 0 ? (
                <p className="text-xs text-zinc-500">
                  Miembros gestionados por la administración del grupo.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {groupMembers.map((m) => (
                    <div
                      key={m.id}
                      className="inline-flex items-center gap-2 border border-zinc-300 bg-zinc-50 px-3 py-1 text-xs"
                    >
                      <strong className="text-zinc-900">{m.username}</strong>
                      <span
                        className={`px-1.5 py-0.5 text-[9px] font-black text-white uppercase ${
                          m.role === "SCAN_LEADER"
                            ? "bg-purple-700"
                            : "bg-emerald-700"
                        }`}
                      >
                        {m.role === "SCAN_LEADER" ? "LÍDER / ADMIN" : "UPLOADER"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Estadísticas del Scanlation */}
          <div className="border border-zinc-300 bg-zinc-50 p-4 text-xs">
            <h3 className="border-b border-zinc-300 pb-1.5 font-black text-zinc-900 uppercase">
              Ficha del Scanlation
            </h3>
            <ul className="mt-2.5 space-y-2">
              <li className="flex justify-between">
                <span className="text-zinc-600">Capítulos subidos:</span>
                <strong className="text-zinc-900">{uploads.length}</strong>
              </li>
              <li className="flex justify-between">
                <span className="text-zinc-600">Obras traducidas:</span>
                <strong className="text-zinc-900">{mangas.length}</strong>
              </li>
              <li className="flex justify-between">
                <span className="text-zinc-600">Miembros activos:</span>
                <strong className="text-zinc-900">{group.membersCount}</strong>
              </li>
              {group.discord && (
                <li className="flex justify-between">
                  <span className="text-zinc-600">Comunidad:</span>
                  <strong className="text-[#1d4ed8]">{group.discord}</strong>
                </li>
              )}
            </ul>
          </div>
        </div>
      </section>

      {/* Obras traducidas por este Scanlation */}
      {mangas.length > 0 && (
        <section className="border border-zinc-300 bg-white p-5 shadow-2xs">
          <h2 className="mb-4 border-b-2 border-zinc-300 pb-2 text-sm font-black tracking-wider text-zinc-900 uppercase">
            📚 Series Traducidas por {group.name} ({mangas.length})
          </h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {mangas.map((m) => (
              <MangaCard key={m.id} manga={m} />
            ))}
          </div>
        </section>
      )}

      {/* Historial de Capítulos Subidos por este Scanlation */}
      <section className="border border-zinc-300 bg-white shadow-2xs">
        <div className="border-b-2 border-zinc-300 bg-zinc-100 px-4 py-2.5">
          <h2 className="text-sm font-black tracking-wider text-zinc-900 uppercase">
            📄 Todos los Capítulos Publicados por {group.name} ({uploads.length}
            )
          </h2>
        </div>

        {uploads.length === 0 ? (
          <div className="p-8 text-center text-xs text-zinc-500">
            Este Scanlation aún no ha publicado capítulos.
          </div>
        ) : (
          <div className="divide-y divide-zinc-200">
            {uploads.map((up) => (
              <div
                key={up.id}
                className="flex items-center justify-between gap-3 px-4 py-2.5 text-xs hover:bg-zinc-50"
              >
                <div>
                  <Link
                    href={`/manga/${up.mangaSlug}`}
                    className="font-extrabold text-zinc-900 hover:text-[#1d4ed8]"
                  >
                    {up.mangaTitle}
                  </Link>
                  <span className="mx-2 text-zinc-400">•</span>
                  <span className="font-semibold text-zinc-700">
                    Capítulo {up.chapterNumber}: {up.chapterTitle}
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-[11px] text-zinc-500">
                    {new Date(up.createdAt).toLocaleDateString("es-ES", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                  <Link
                    href={`/leer/${up.id}`}
                    className="border border-[#1e40af] bg-[#1d4ed8] px-3 py-1 font-extrabold text-white uppercase hover:bg-[#1e40af]"
                  >
                    ▶ Leer
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

export default function ScanlationDetailPage(
  props: PageProps<"/grupos/[slug]">
) {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-7xl px-4 py-12 text-center text-xs font-bold text-zinc-600">
          Cargando ficha del Scanlation...
        </div>
      }
    >
      <ScanlationDetailContent paramsPromise={props.params} />
    </Suspense>
  );
}

