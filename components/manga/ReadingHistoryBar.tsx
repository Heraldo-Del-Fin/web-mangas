"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export const READING_HISTORY_KEY = "kuramanga_reading_history_v1";

export interface ReadingHistoryEntry {
  uploadId: string;
  mangaSlug: string;
  mangaTitle: string;
  mangaCover: string;
  chapterNumber: number;
  chapterTitle: string;
  scanlationName: string;
  readAt: string;
}

export function ReadingHistoryBar() {
  const [history, setHistory] = useState<ReadingHistoryEntry[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(READING_HISTORY_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as ReadingHistoryEntry[];
        setHistory(parsed.slice(0, 4));
      }
    } catch {
      // ignore
    }
  }, []);

  const clearHistory = () => {
    try {
      localStorage.removeItem(READING_HISTORY_KEY);
      setHistory([]);
    } catch {
      // ignore
    }
  };

  if (history.length === 0) return null;

  return (
    <section className="border border-zinc-300 bg-white shadow-2xs">
      <div className="flex items-center justify-between border-b-2 border-zinc-300 bg-zinc-100 px-4 py-2">
        <h2 className="text-xs font-black tracking-wider text-zinc-900 uppercase">
          📖 Continuar Leyendo (Tu Historial Reciente)
        </h2>
        <button
          type="button"
          onClick={clearHistory}
          className="text-[11px] font-bold text-zinc-500 hover:text-rose-700 hover:underline"
        >
          [ Limpiar historial ]
        </button>
      </div>

      <div className="grid grid-cols-1 divide-y divide-zinc-200 sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4">
        {history.map((item) => (
          <div
            key={item.uploadId}
            className="flex items-center justify-between gap-3 p-3 hover:bg-zinc-50"
          >
            <div className="flex min-w-0 items-center gap-2.5">
              <Link
                href={`/manga/${item.mangaSlug}`}
                className="h-14 w-10 shrink-0 overflow-hidden border border-zinc-300 bg-zinc-100"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.mangaCover}
                  alt={item.mangaTitle}
                  className="h-full w-full object-cover"
                />
              </Link>
              <div className="min-w-0">
                <Link
                  href={`/manga/${item.mangaSlug}`}
                  className="block truncate text-xs font-extrabold text-zinc-900 hover:text-[#1d4ed8]"
                >
                  {item.mangaTitle}
                </Link>
                <p className="truncate text-[11px] font-bold text-[#1d4ed8]">
                  Cap. {item.chapterNumber}
                </p>
                <p className="truncate text-[10px] text-zinc-500">
                  {item.scanlationName}
                </p>
              </div>
            </div>

            <Link
              href={`/leer/${item.uploadId}`}
              className="shrink-0 border border-[#1e40af] bg-[#1d4ed8] px-2.5 py-1 text-[11px] font-extrabold text-white uppercase hover:bg-[#1e40af]"
            >
              ▶ Retomar
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
}

