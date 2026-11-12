"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function Footer() {
  const pathname = usePathname();
  if (pathname?.startsWith("/leer/")) return null;

  return (
    <footer className="mt-16 border-t-2 border-zinc-300 bg-white text-zinc-600">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
          <div className="md:col-span-2">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center border border-zinc-900 bg-[#d9381e] font-black text-white">
                <span className="text-sm">蔵</span>
              </div>
              <span className="text-lg font-black tracking-tight text-zinc-900 uppercase">
                KURA<span className="text-[#1d4ed8]">MANGA</span>
              </span>
            </div>
            <p className="mt-3 max-w-md text-xs leading-relaxed text-zinc-600">
              Biblioteca y lector de mangas, manhwas, manhuas y novelas en
              español con diseño editorial clásico de alto contraste. Lectura en
              tira continua (Cascada) o paginada y publicación abierta para
              Scanlations.
            </p>
            <div className="mt-4 flex flex-wrap gap-1.5">
              <span className="border border-[#e67e22] bg-[#e67e22] px-2 py-0.5 text-[10px] font-extrabold text-white uppercase">
                Shounen
              </span>
              <span className="border border-[#c0392b] bg-[#c0392b] px-2 py-0.5 text-[10px] font-extrabold text-white uppercase">
                Seinen
              </span>
              <span className="border border-[#d81b60] bg-[#d81b60] px-2 py-0.5 text-[10px] font-extrabold text-white uppercase">
                Shoujo
              </span>
              <span className="border border-[#7b1fa2] bg-[#7b1fa2] px-2 py-0.5 text-[10px] font-extrabold text-white uppercase">
                Josei
              </span>
            </div>
          </div>

          <div>
            <h3 className="border-b border-zinc-300 pb-1.5 text-xs font-black tracking-wider text-zinc-900 uppercase">
              Catálogo Editorial
            </h3>
            <ul className="mt-3 space-y-1.5 text-xs font-medium">
              <li>
                <Link
                  href="/biblioteca?type=MANGA"
                  className="hover:text-[#1d4ed8] hover:underline"
                >
                  » Mangas (Japón)
                </Link>
              </li>
              <li>
                <Link
                  href="/biblioteca?type=MANHWA"
                  className="hover:text-[#1d4ed8] hover:underline"
                >
                  » Manhwas (Corea / Webtoon)
                </Link>
              </li>
              <li>
                <Link
                  href="/biblioteca?type=MANHUA"
                  className="hover:text-[#1d4ed8] hover:underline"
                >
                  » Manhuas (China)
                </Link>
              </li>
              <li>
                <Link
                  href="/biblioteca?demography=SEINEN"
                  className="hover:text-[#1d4ed8] hover:underline"
                >
                  » Demografía Seinen
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="border-b border-zinc-300 pb-1.5 text-xs font-black tracking-wider text-zinc-900 uppercase">
              Comunidad &amp; Cuenta
            </h3>
            <ul className="mt-3 space-y-1.5 text-xs font-medium">
              <li>
                <Link
                  href="/grupos"
                  className="hover:text-[#1d4ed8] hover:underline"
                >
                  » Directorio de Scanlations
                </Link>
              </li>
              <li>
                <Link
                  href="/biblioteca"
                  className="hover:text-[#1d4ed8] hover:underline"
                >
                  » Explorar Biblioteca Completa
                </Link>
              </li>
              <li>
                <Link
                  href="/login"
                  className="hover:text-[#1d4ed8] hover:underline"
                >
                  » Iniciar Sesión
                </Link>
              </li>
              <li>
                <Link
                  href="/registro"
                  className="hover:text-[#1d4ed8] hover:underline"
                >
                  » Crear Cuenta de Lector
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-8 border-t border-zinc-200 pt-5 text-center text-xs text-zinc-500">
          © 2026 KuruManga — Archivo &amp; Lector Clásico de Manga. Todas las
          obras pertenecen a sus respectivos autores y grupos de traducción.
        </div>
      </div>
    </footer>
  );
}
