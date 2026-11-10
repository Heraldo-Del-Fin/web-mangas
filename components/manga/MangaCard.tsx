import Link from "next/link";
import { DEMOGRAPHIES, Manga, WORK_TYPES } from "@/lib/types";

export function MangaCard({ manga }: { manga: Manga }) {
  const typeInfo = WORK_TYPES[manga.type];
  const demoInfo = DEMOGRAPHIES[manga.demography];
  const latestChapter =
    manga.chapters.length > 0
      ? manga.chapters[manga.chapters.length - 1]
      : null;

  return (
    <Link
      href={`/manga/${manga.slug}`}
      className="group flex flex-col border border-zinc-300 bg-white shadow-2xs transition-colors hover:border-[#1d4ed8]"
    >
      {/* Portada Rectangular con bordes rectos */}
      <div className="relative aspect-[2/3] w-full overflow-hidden border-b border-zinc-300 bg-zinc-100">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={manga.coverUrl}
          alt={manga.title}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-103"
        />

        {/* Etiqueta Superior Izquierda (Recta) */}
        <span
          className={`absolute top-0 left-0 border-r border-b px-2 py-0.5 text-[10px] font-extrabold tracking-wider uppercase ${typeInfo.badgeClass}`}
        >
          {typeInfo.short}
        </span>

        {/* Puntuación Superior Derecha (Recta) */}
        <span className="absolute top-0 right-0 flex items-center gap-1 border-b border-l border-zinc-700 bg-zinc-900/95 px-2 py-0.5 text-[11px] font-bold text-amber-400">
          <span>★</span>
          <span>{manga.rating.toFixed(2)}</span>
        </span>

        {/* Barra de Demografía Clásica Inferior */}
        <div
          className={`absolute right-0 bottom-0 left-0 flex h-6 items-center justify-center text-[10px] font-black tracking-widest uppercase ${demoInfo.bgBarClass}`}
        >
          {demoInfo.label}
        </div>
      </div>

      {/* Pie de Ficha Blanco Clásico (Estilo MangaDex / Jump / TMO Antiguo) */}
      <div className="flex flex-1 flex-col justify-between p-2.5">
        <div>
          <h3 className="line-clamp-2 text-xs leading-snug font-extrabold text-zinc-900 group-hover:text-[#1d4ed8] sm:text-sm">
            {manga.title}
          </h3>
          <p className="mt-0.5 truncate text-[11px] text-zinc-500">
            {manga.author}
          </p>
        </div>

        <div className="mt-2 flex items-center justify-between border-t border-zinc-200 pt-1.5 text-[11px]">
          {latestChapter ? (
            <span className="font-bold text-[#1d4ed8]">
              Cap. {latestChapter.number}
            </span>
          ) : (
            <span className="text-zinc-400">Sin caps</span>
          )}
          <span className="font-medium text-zinc-500">
            {manga.chapters.length} caps
          </span>
        </div>
      </div>
    </Link>
  );
}
