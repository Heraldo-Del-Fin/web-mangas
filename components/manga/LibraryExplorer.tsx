"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { MangaCard } from "@/components/manga/MangaCard";
import {
  ALL_GENRES,
  DEMOGRAPHIES,
  Demography,
  Manga,
  WORK_STATUSES,
  WORK_TYPES,
  WorkStatus,
  WorkType,
} from "@/lib/types";

export function LibraryExplorer({ initialMangas }: { initialMangas: Manga[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [query, setQuery] = useState(searchParams.get("q") || "");
  const [type, setType] = useState<WorkType | "ALL">(
    (searchParams.get("type") as WorkType) || "ALL"
  );
  const [demography, setDemography] = useState<Demography | "ALL">(
    (searchParams.get("demography") as Demography) || "ALL"
  );
  const [status, setStatus] = useState<WorkStatus | "ALL">(
    (searchParams.get("status") as WorkStatus) || "ALL"
  );
  const [genre, setGenre] = useState<string>(
    searchParams.get("genre") || "ALL"
  );
  const [sort, setSort] = useState<"views" | "rating" | "latest" | "az">(
    (searchParams.get("sort") as "views" | "rating" | "latest" | "az") ||
      "views"
  );

  const filteredMangas = useMemo(() => {
    let list = [...initialMangas];

    if (query.trim() !== "") {
      const q = query.trim().toLowerCase();
      list = list.filter(
        (m) =>
          m.title.toLowerCase().includes(q) ||
          m.author.toLowerCase().includes(q) ||
          m.altTitles.some((alt) => alt.toLowerCase().includes(q))
      );
    }

    if (type !== "ALL") {
      list = list.filter((m) => m.type === type);
    }

    if (demography !== "ALL") {
      list = list.filter((m) => m.demography === demography);
    }

    if (status !== "ALL") {
      list = list.filter((m) => m.status === status);
    }

    if (genre !== "ALL") {
      list = list.filter((m) =>
        m.genres.some((g) => g.toLowerCase() === genre.toLowerCase())
      );
    }

    if (sort === "rating") {
      list.sort((a, b) => b.rating - a.rating);
    } else if (sort === "latest") {
      list.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    } else if (sort === "az") {
      list.sort((a, b) => a.title.localeCompare(b.title));
    } else {
      list.sort((a, b) => b.views - a.views);
    }

    return list;
  }, [initialMangas, query, type, demography, status, genre, sort]);

  const resetFilters = () => {
    setQuery("");
    setType("ALL");
    setDemography("ALL");
    setStatus("ALL");
    setGenre("ALL");
    setSort("views");
    router.replace("/biblioteca");
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
      {/* Columna Lateral de Filtros (Bordes rectos, fondo blanco) */}
      <aside className="h-fit border border-zinc-300 bg-white shadow-2xs">
        <div className="flex items-center justify-between border-b-2 border-zinc-300 bg-zinc-100 px-4 py-2.5">
          <h2 className="text-xs font-black tracking-wider text-zinc-900 uppercase">
            🔍 Filtros de Búsqueda
          </h2>
          <button
            type="button"
            onClick={resetFilters}
            className="text-xs font-bold text-[#1d4ed8] hover:underline"
          >
            [ Reiniciar ]
          </button>
        </div>

        <div className="space-y-4 p-4">
          {/* Buscar por texto */}
          <div>
            <label className="mb-1 block text-[11px] font-extrabold text-zinc-700 uppercase">
              Título o Autor
            </label>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ej: Monarca, Berserker..."
              className="w-full rounded-none border border-zinc-400 bg-zinc-50 px-3 py-1.5 text-xs text-zinc-900 placeholder-zinc-500 focus:border-[#1d4ed8] focus:bg-white focus:outline-none"
            />
          </div>

          {/* Ordenar por */}
          <div>
            <label className="mb-1 block text-[11px] font-extrabold text-zinc-700 uppercase">
              Ordenar por
            </label>
            <select
              value={sort}
              onChange={(e) =>
                setSort(e.target.value as "views" | "rating" | "latest" | "az")
              }
              className="w-full rounded-none border border-zinc-400 bg-white px-2.5 py-1.5 text-xs font-bold text-zinc-900 focus:border-[#1d4ed8] focus:outline-none"
            >
              <option value="views">Más Leídos (Vistas)</option>
              <option value="rating">Mejor Puntuación (★)</option>
              <option value="latest">Recién Agregados</option>
              <option value="az">Orden Alfabético (A - Z)</option>
            </select>
          </div>

          {/* Tipo de Obra */}
          <div>
            <label className="mb-1 block text-[11px] font-extrabold text-zinc-700 uppercase">
              Tipo de Obra
            </label>
            <div className="grid grid-cols-2 gap-1">
              <button
                type="button"
                onClick={() => setType("ALL")}
                className={`border px-2 py-1.5 text-xs font-extrabold uppercase ${
                  type === "ALL"
                    ? "border-[#1e40af] bg-[#1d4ed8] text-white"
                    : "border-zinc-300 bg-zinc-50 text-zinc-700 hover:bg-zinc-100"
                }`}
              >
                Todos
              </button>
              {(Object.keys(WORK_TYPES) as WorkType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={`border px-2 py-1.5 text-xs font-extrabold uppercase ${
                    type === t
                      ? "border-[#1e40af] bg-[#1d4ed8] text-white"
                      : "border-zinc-300 bg-zinc-50 text-zinc-700 hover:bg-zinc-100"
                  }`}
                >
                  {WORK_TYPES[t].label}
                </button>
              ))}
            </div>
          </div>

          {/* Demografía */}
          <div>
            <label className="mb-1 block text-[11px] font-extrabold text-zinc-700 uppercase">
              Demografía
            </label>
            <div className="flex flex-col gap-1">
              <button
                type="button"
                onClick={() => setDemography("ALL")}
                className={`border px-3 py-1.5 text-left text-xs font-bold ${
                  demography === "ALL"
                    ? "border-zinc-900 bg-zinc-900 text-white"
                    : "border-zinc-300 bg-zinc-50 text-zinc-800 hover:bg-zinc-100"
                }`}
              >
                Todas las demografías
              </button>
              {(Object.keys(DEMOGRAPHIES) as Demography[]).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDemography(d)}
                  className={`flex items-center justify-between border px-3 py-1.5 text-xs font-bold ${
                    demography === d
                      ? "border-zinc-900 bg-zinc-900 text-white"
                      : "border-zinc-300 bg-zinc-50 text-zinc-800 hover:bg-zinc-100"
                  }`}
                >
                  <span>{DEMOGRAPHIES[d].label}</span>
                  <span
                    className={`px-1.5 py-0.2 text-[9px] font-black uppercase ${DEMOGRAPHIES[d].colorClass}`}
                  >
                    {d.slice(0, 3)}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Estado */}
          <div>
            <label className="mb-1 block text-[11px] font-extrabold text-zinc-700 uppercase">
              Estado
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as WorkStatus | "ALL")}
              className="w-full rounded-none border border-zinc-400 bg-white px-2.5 py-1.5 text-xs font-bold text-zinc-900 focus:border-[#1d4ed8] focus:outline-none"
            >
              <option value="ALL">Cualquier estado</option>
              {(Object.keys(WORK_STATUSES) as WorkStatus[]).map((s) => (
                <option key={s} value={s}>
                  {WORK_STATUSES[s].label}
                </option>
              ))}
            </select>
          </div>

          {/* Género */}
          <div>
            <label className="mb-1 block text-[11px] font-extrabold text-zinc-700 uppercase">
              Género
            </label>
            <select
              value={genre}
              onChange={(e) => setGenre(e.target.value)}
              className="w-full rounded-none border border-zinc-400 bg-white px-2.5 py-1.5 text-xs font-bold text-zinc-900 focus:border-[#1d4ed8] focus:outline-none"
            >
              <option value="ALL">Todos los géneros</option>
              {ALL_GENRES.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>
        </div>
      </aside>

      {/* Columna Principal de Resultados */}
      <div className="space-y-4 lg:col-span-3">
        <div className="flex flex-wrap items-center justify-between gap-2 border border-zinc-300 bg-white px-4 py-2.5 shadow-2xs">
          <p className="text-xs font-extrabold text-zinc-800 uppercase">
            Resultados en Directorio:{" "}
            <span className="text-[#1d4ed8]">{filteredMangas.length}</span>{" "}
            obras
          </p>
        </div>

        {filteredMangas.length === 0 ? (
          <div className="border border-zinc-300 bg-white p-12 text-center">
            <p className="text-base font-black text-zinc-900">
              No se encontraron obras con esos filtros
            </p>
            <p className="mt-1 text-xs text-zinc-600">
              Prueba limpiando los filtros o registra una nueva obra en el
              archivo.
            </p>
            <button
              type="button"
              onClick={resetFilters}
              className="mt-4 border border-[#1e40af] bg-[#1d4ed8] px-4 py-2 text-xs font-extrabold text-white uppercase hover:bg-[#1e40af]"
            >
              Reiniciar Filtros
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {filteredMangas.map((manga) => (
              <MangaCard key={manga.id} manga={manga} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
