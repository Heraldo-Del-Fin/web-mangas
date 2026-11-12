"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { logoutAction } from "@/lib/auth-actions";
import { SessionUser, USER_ROLES } from "@/lib/types";

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<SessionUser | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/me")
      .then((r) => r.json())
      .then((data) => {
        if (active) setCurrentUser(data.user ?? null);
      })
      .catch(() => {
        // ignore
      });
    return () => {
      active = false;
    };
  }, []);

  const isReader = pathname?.startsWith("/leer/");
  if (isReader) return null;

  const handleSearch = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = search.trim();
    if (trimmed) {
      router.push(`/biblioteca?q=${encodeURIComponent(trimmed)}`);
      setMobileOpen(false);
    } else {
      router.push("/biblioteca");
    }
  };

  const handleLogout = async () => {
    await logoutAction();
    setCurrentUser(null);
    router.push("/");
    router.refresh();
  };

  const canUpload = Boolean(currentUser?.canUpload);

  const navItems = [
    { href: "/", label: "PORTADA" },
    { href: "/biblioteca", label: "DIRECTORIO" },
    { href: "/grupos", label: "SCANLATIONS" },
    ...(currentUser
      ? [
          { href: "/mis-listas", label: "MI BIBLIOTECA" },
          { href: "/panel", label: "PANEL / ROLES" },
        ]
      : []),
  ];

  const getRoleBadge = (user: SessionUser) => {
    if (user.role === "ADMIN") {
      return {
        label: "ADMIN",
        className: USER_ROLES.ADMIN.badgeClass,
      };
    }
    if (user.isScanLeader) {
      return {
        label: "LÍDER SCAN",
        className: "bg-purple-700 text-white border-purple-900",
      };
    }
    if (user.role === "UPLOADER") {
      return {
        label: "UPLOADER",
        className: USER_ROLES.UPLOADER.badgeClass,
      };
    }
    if (user.memberships.length > 0) {
      return {
        label: `UPLOADER (${user.memberships[0].scanlationName})`,
        className: "bg-emerald-700 text-white border-emerald-900",
      };
    }
    return {
      label: "LECTOR",
      className: USER_ROLES.READER.badgeClass,
    };
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-zinc-300 bg-white shadow-2xs">
      {/* Barra superior clásica con estado de sesión y accesos */}
      <div className="border-b border-zinc-200 bg-zinc-900 text-zinc-200">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-1.5 text-[11px] font-medium sm:px-6">
          <div className="flex items-center gap-3 overflow-x-auto whitespace-nowrap">
            <span className="font-bold tracking-wider text-amber-400 uppercase">
              KuruManga:
            </span>
            <Link
              href="/biblioteca?type=MANGA"
              className="hover:text-white hover:underline"
            >
              Manga (JP)
            </Link>
            <span className="text-zinc-600">|</span>
            <Link
              href="/biblioteca?type=MANHWA"
              className="hover:text-white hover:underline"
            >
              Manhwa (KR)
            </Link>
            <span className="text-zinc-600">|</span>
            <Link
              href="/biblioteca?type=MANHUA"
              className="hover:text-white hover:underline"
            >
              Manhua (CN)
            </Link>
          </div>

          {/* Barra de Cuenta y Rol */}
          <div className="flex items-center gap-2.5">
            {currentUser ? (
              <>
                <span className="text-zinc-300">
                  Conectado como{" "}
                  <strong className="text-white">{currentUser.username}</strong>
                </span>
                <span
                  className={`border px-1.5 py-0.2 text-[9px] font-black uppercase ${
                    getRoleBadge(currentUser).className
                  }`}
                >
                  {getRoleBadge(currentUser).label}
                </span>
                <Link
                  href="/panel"
                  className="font-bold text-amber-400 hover:underline"
                >
                  [Mi Panel]
                </Link>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="font-bold text-rose-400 hover:underline"
                >
                  [Salir]
                </button>
              </>
            ) : (
              <>
                <span className="text-zinc-400">Invitado</span>
                <Link
                  href="/login"
                  className="font-extrabold text-amber-400 hover:underline"
                >
                  [Iniciar Sesión]
                </Link>
                <span className="text-zinc-600">|</span>
                <Link
                  href="/registro"
                  className="font-bold text-white hover:underline"
                >
                  [Crear Cuenta]
                </Link>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Barra Principal Blanca Clásica con bordes rectos */}
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center border-2 border-zinc-900 bg-[#d9381e] font-black text-white">
              <span className="text-base tracking-tighter">蔵</span>
            </div>
            <div className="flex flex-col">
              <span className="text-lg leading-none font-black tracking-tight text-zinc-900 uppercase">
                KURU<span className="text-[#1d4ed8]">MANGA</span>
              </span>
              <span className="mt-0.5 text-[10px] font-bold tracking-widest text-zinc-500 uppercase">
                Biblioteca &amp; Lector
              </span>
            </div>
          </Link>

          <nav className="hidden items-center border-l border-zinc-300 pl-4 lg:flex">
            {navItems.map((item) => {
              const active =
                item.href === "/"
                  ? pathname === "/"
                  : pathname?.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`border-b-2 px-3 py-2 text-xs font-extrabold tracking-wider transition-colors ${
                    active
                      ? "border-[#1d4ed8] bg-blue-50/70 text-[#1d4ed8]"
                      : "border-transparent text-zinc-700 hover:bg-zinc-100 hover:text-zinc-950"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Buscador Rectangular Clásico + Botón de Subida */}
        <div className="flex flex-1 items-center justify-end gap-2.5">
          <form
            onSubmit={handleSearch}
            className="hidden w-full max-w-xs items-center sm:flex"
          >
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar título, autor o género..."
              className="w-full rounded-none border border-zinc-400 bg-zinc-50 px-3 py-1.5 text-xs font-medium text-zinc-900 placeholder-zinc-500 focus:border-[#1d4ed8] focus:bg-white focus:outline-none"
            />
            <button
              type="submit"
              className="border border-l-0 border-zinc-800 bg-zinc-800 px-3 py-1.5 text-xs font-bold text-white hover:bg-zinc-700"
            >
              Buscar
            </button>
          </form>

          {canUpload && (
            <Link
              href="/subir"
              className="inline-flex items-center gap-1.5 border border-[#1e40af] bg-[#1d4ed8] px-3.5 py-1.5 text-xs font-extrabold tracking-wide text-white uppercase shadow-2xs transition hover:bg-[#1e40af]"
            >
              <span>+ Subir Obra / Cap</span>
            </Link>
          )}

          <button
            type="button"
            onClick={() => setMobileOpen((prev) => !prev)}
            className="inline-flex items-center justify-center border border-zinc-400 bg-zinc-100 p-1.5 text-zinc-800 hover:bg-zinc-200 lg:hidden"
            aria-label="Abrir menú"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Menú Móvil Clásico */}
      {mobileOpen && (
        <div className="border-t border-zinc-300 bg-zinc-50 px-4 py-3 lg:hidden">
          <form onSubmit={handleSearch} className="mb-3 flex">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar título, autor..."
              className="w-full rounded-none border border-zinc-400 bg-white px-3 py-1.5 text-xs text-zinc-900"
            />
            <button
              type="submit"
              className="border border-l-0 border-zinc-800 bg-zinc-800 px-3 py-1.5 text-xs font-bold text-white"
            >
              Ir
            </button>
          </form>
          <div className="flex flex-col divide-y divide-zinc-200 border border-zinc-300 bg-white">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className="px-3 py-2 text-xs font-extrabold text-zinc-800 hover:bg-zinc-100"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </header>
  );
}
