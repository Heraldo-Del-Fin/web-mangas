"use client";

import { useEffect, useState } from "react";
import { UserListStatus } from "@/lib/types";

const LIST_OPTIONS: {
  key: UserListStatus;
  label: string;
  icon: string;
  activeClass: string;
}[] = [
  {
    key: "SIGUIENDO",
    label: "Siguiendo",
    icon: "🔔",
    activeClass: "bg-[#1d4ed8] text-white border-[#1e40af]",
  },
  {
    key: "PENDIENTE",
    label: "Pendiente",
    icon: "🕒",
    activeClass: "bg-[#d97706] text-white border-[#b45309]",
  },
  {
    key: "LEIDO",
    label: "Completado",
    icon: "✓",
    activeClass: "bg-[#15803d] text-white border-[#166534]",
  },
  {
    key: "FAVORITO",
    label: "Favorito",
    icon: "★",
    activeClass: "bg-[#c0392b] text-white border-[#991b1b]",
  },
  {
    key: "ABANDONADO",
    label: "Abandonado",
    icon: "✕",
    activeClass: "bg-zinc-700 text-white border-zinc-900",
  },
];

export const STORAGE_LISTS_KEY = "tmo_user_lists_v1";

export interface StoredMangaListEntry {
  mangaId: string;
  slug: string;
  title: string;
  coverUrl: string;
  type: string;
  demography: string;
  rating: number;
  status: UserListStatus;
  updatedAt: string;
}

export function UserListButtons({
  manga,
}: {
  manga: {
    id: string;
    slug: string;
    title: string;
    coverUrl: string;
    type: string;
    demography: string;
    rating: number;
  };
}) {
  const [selected, setSelected] = useState<UserListStatus | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_LISTS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, StoredMangaListEntry>;
        if (parsed[manga.id]) {
          setSelected(parsed[manga.id].status);
        }
      }
    } catch {
      // ignore storage errors
    }
  }, [manga.id]);

  const handleToggle = (status: UserListStatus) => {
    try {
      const raw = localStorage.getItem(STORAGE_LISTS_KEY);
      const map: Record<string, StoredMangaListEntry> = raw
        ? JSON.parse(raw)
        : {};

      if (selected === status) {
        delete map[manga.id];
        setSelected(null);
      } else {
        map[manga.id] = {
          mangaId: manga.id,
          slug: manga.slug,
          title: manga.title,
          coverUrl: manga.coverUrl,
          type: manga.type,
          demography: manga.demography,
          rating: manga.rating,
          status,
          updatedAt: new Date().toISOString(),
        };
        setSelected(status);
      }

      localStorage.setItem(STORAGE_LISTS_KEY, JSON.stringify(map));
    } catch {
      // ignore storage errors
    }
  };

  return (
    <div className="flex flex-wrap gap-1.5">
      {LIST_OPTIONS.map((opt) => {
        const isActive = selected === opt.key;
        return (
          <button
            key={opt.key}
            type="button"
            onClick={() => handleToggle(opt.key)}
            className={`inline-flex items-center gap-1.5 border px-3 py-1.5 text-xs font-extrabold uppercase transition ${
              isActive
                ? opt.activeClass
                : "border-zinc-400 bg-zinc-100 text-zinc-800 hover:bg-zinc-200"
            }`}
          >
            <span>{opt.icon}</span>
            <span>{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
