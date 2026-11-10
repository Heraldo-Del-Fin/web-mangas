"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  STORAGE_LISTS_KEY,
  StoredMangaListEntry,
} from "@/components/manga/UserListButtons";
import {
  DEMOGRAPHIES,
  Demography,
  UserListStatus,
  WORK_TYPES,
  WorkType,
} from "@/lib/types";

const TABS: { key: UserListStatus | "ALL"; label: string }[] = [
  { key: "ALL", label: "TODAS" },
  { key: "SIGUIENDO", label: "SIGUIENDO" },
  { key: "PENDIENTE", label: "PENDIENTES" },
  { key: "LEIDO", label: "COMPLETADOS" },
  { key: "FAVORITO", label: "FAVORITOS" },
  { key: "ABANDONADO", label: "ABANDONADOS" },
];

export default function MisListasPage() {
  const [entries, setEntries] = useState<StoredMangaListEntry[]>([]);
  const [activeTab, setActiveTab] = useState<UserListStatus | "ALL">("ALL");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_LISTS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, StoredMangaListEntry>;
        setEntries(Object.values(parsed));
      }
    } catch {
      // ignore
    }
  }, []);

  const removeEntry = (mangaId: string) => {
    try {
      const raw = localStorage.getItem(STORAGE_LISTS_KEY);
      const parsed: Record<string, StoredMangaListEntry> = raw
        ? JSON.parse(raw)
        : {};
      delete parsed[mangaId];
      localStorage.setItem(STORAGE_LISTS_KEY, JSON.stringify(parsed));
      setEntries(Object.values(parsed));
    } catch {
      // ignore
    }
  };

  const filtered =
    activeTab === "ALL"
      ? entries
      : entries.filter((e) => e.status === activeTab);

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">
      <div className="border border-zinc-300 bg-white px-5 py-4 shadow-2xs">
        <h1 className="text-xl font-black tracking-tight text-zinc-900 uppercase sm:text-2xl">
          🔖 Mi Biblioteca de Seguimiento
        </h1>
        <p className="mt-0.5 text-xs text-zinc-600">
          Obras guardadas en tu navegador (Siguiendo, Pendientes, Completados y
          Favoritos).
        </p>
      </div>

      {/* Pestañas Rectangulares */}
      <div className="flex flex-wrap border border-zinc-300 bg-white p-1.5 shadow-2xs">
        {TABS.map((t) => {
          const count =
            t.key === "ALL"
              ? entries.length
              : entries.filter((e) => e.status === t.key).length;
          const active = activeTab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setActiveTab(t.key)}
              className={`px-3.5 py-1.5 text-xs font-extrabold uppercase transition ${
                active
                  ? "bg-[#1d4ed8] text-white"
                  : "text-zinc-700 hover:bg-zinc-100"
              }`}
            >
              {t.label} ({count})
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="border border-zinc-300 bg-white p-12 text-center shadow-2xs">
          <p className="text-sm font-black text-zinc-900 uppercase">
            No tienes obras guardadas en esta categoría
          </p>
          <p className="mt-1 text-xs text-zinc-600">
            Abre la ficha de cualquier manga y pulsa «Siguiendo», «Pendiente» o
            «Favorito».
          </p>
          <Link
            href="/biblioteca"
            className="mt-4 inline-block border border-[#1e40af] bg-[#1d4ed8] px-4 py-2 text-xs font-extrabold text-white uppercase hover:bg-[#1e40af]"
          >
            Ir al Directorio »
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {filtered.map((item) => {
            const typeInfo =
              WORK_TYPES[item.type as WorkType] || WORK_TYPES.MANGA;
            const demoInfo =
              DEMOGRAPHIES[item.demography as Demography] ||
              DEMOGRAPHIES.SHOUNEN;

            return (
              <div
                key={item.mangaId}
                className="flex flex-col border border-zinc-300 bg-white shadow-2xs"
              >
                <Link
                  href={`/manga/${item.slug}`}
                  className="relative aspect-[2/3] w-full overflow-hidden border-b border-zinc-300 bg-zinc-100"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.coverUrl}
                    alt={item.title}
                    className="h-full w-full object-cover"
                  />
                  <span
                    className={`absolute top-0 left-0 border-r border-b px-2 py-0.5 text-[10px] font-extrabold uppercase ${typeInfo.badgeClass}`}
                  >
                    {typeInfo.short}
                  </span>
                  <div
                    className={`absolute right-0 bottom-0 left-0 flex h-6 items-center justify-center text-[10px] font-black uppercase ${demoInfo.bgBarClass}`}
                  >
                    {demoInfo.label}
                  </div>
                </Link>

                <div className="flex flex-1 flex-col justify-between p-2.5">
                  <Link
                    href={`/manga/${item.slug}`}
                    className="line-clamp-2 text-xs font-extrabold text-zinc-900 hover:text-[#1d4ed8]"
                  >
                    {item.title}
                  </Link>
                  <div className="mt-2 flex items-center justify-between border-t border-zinc-200 pt-1.5 text-[11px]">
                    <span className="font-bold text-[#1d4ed8]">
                      {item.status}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeEntry(item.mangaId)}
                      className="font-bold text-rose-700 hover:underline"
                    >
                      Quitar ✕
                    </button>
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
