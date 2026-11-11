"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { loginAction } from "@/lib/auth-actions";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const res = await loginAction(formData);
    setLoading(false);

    if (!res.success) {
      setError(res.error || "Error al iniciar sesión.");
      return;
    }

    router.push("/panel");
    router.refresh();
  };

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Columna Izquierda: Formulario de Inicio de Sesión */}
        <div className="border border-zinc-300 bg-white p-6 shadow-2xs">
          <div className="border-b-2 border-zinc-300 pb-3">
            <span className="border border-zinc-400 bg-zinc-100 px-2 py-0.5 text-[10px] font-extrabold text-zinc-800 uppercase">
              Acceso de Usuarios
            </span>
            <h1 className="mt-1.5 text-xl font-black text-zinc-900 uppercase">
              Iniciar Sesión
            </h1>
          </div>

          {error && (
            <div className="mt-4 border border-rose-500 bg-rose-50 p-3 text-xs font-bold text-rose-800">
              ⚠️ {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div>
              <label className="mb-1 block text-xs font-extrabold text-zinc-800 uppercase">
                Usuario o Correo Electrónico
              </label>
              <input
                type="text"
                name="identifier"
                required
                placeholder="Tu usuario o correo electrónico"
                className="w-full rounded-none border border-zinc-400 bg-zinc-50 px-3 py-2 text-xs font-semibold text-zinc-900 focus:border-[#1d4ed8] focus:bg-white focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-extrabold text-zinc-800 uppercase">
                Contraseña
              </label>
              <input
                type="password"
                name="password"
                required
                placeholder="••••••••"
                className="w-full rounded-none border border-zinc-400 bg-zinc-50 px-3 py-2 text-xs font-semibold text-zinc-900 focus:border-[#1d4ed8] focus:bg-white focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full border border-[#1e40af] bg-[#1d4ed8] py-2.5 text-xs font-extrabold tracking-wider text-white uppercase hover:bg-[#1e40af] disabled:opacity-50"
            >
              {loading ? "Verificando credenciales..." : "Entrar a mi Cuenta »"}
            </button>
          </form>

          <div className="mt-5 border-t border-zinc-200 pt-4 text-center text-xs text-zinc-600">
            ¿Aún no tienes cuenta?{" "}
            <Link
              href="/registro"
              className="font-extrabold text-[#1d4ed8] hover:underline"
            >
              Crear Cuenta Nueva »
            </Link>
          </div>
        </div>

        {/* Columna Derecha: Guía Editorial de Cuentas y Roles */}
        <div className="border border-zinc-300 bg-white p-6 shadow-2xs">
          <div className="border-b-2 border-zinc-300 pb-3">
            <span className="border border-zinc-400 bg-zinc-100 px-2 py-0.5 text-[10px] font-extrabold text-zinc-800 uppercase">
              Sistema de Permisos
            </span>
            <h2 className="mt-1.5 text-base font-black text-zinc-900 uppercase">
              Jerarquía de Cuentas y Scanlations
            </h2>
            <p className="mt-0.5 text-xs text-zinc-600">
              Funcionamiento oficial de cuentas, grupos de traducción y subidas:
            </p>
          </div>

          <div className="mt-4 space-y-3 text-xs">
            <div className="border border-zinc-300 bg-zinc-50 p-3">
              <div className="flex items-center justify-between">
                <strong className="text-zinc-900 uppercase">
                  1. Lector Registrado (READER)
                </strong>
                <span className="border border-zinc-400 bg-zinc-200 px-2 py-0.5 text-[10px] font-black text-zinc-800 uppercase">
                  CUENTA INICIAL
                </span>
              </div>
              <p className="mt-1 text-[11px] text-zinc-600">
                Guarda mangas en listas personales, califica obras, comenta y
                puede enviar solicitud en <code>/panel</code> para ser Uploader
                o fundar un Scanlation.
              </p>
            </div>

            <div className="border border-zinc-300 bg-zinc-50 p-3">
              <div className="flex items-center justify-between">
                <strong className="text-zinc-900 uppercase">
                  2. Uploader de Scanlation
                </strong>
                <span className="bg-emerald-700 px-2 py-0.5 text-[10px] font-black text-white uppercase">
                  SCAN UPLOADER
                </span>
              </div>
              <p className="mt-1 text-[11px] text-zinc-600">
                Designado por el líder de un Scanlation para publicar capítulos
                exclusivamente bajo el sello de ese grupo.
              </p>
            </div>

            <div className="border border-zinc-300 bg-zinc-50 p-3">
              <div className="flex items-center justify-between">
                <strong className="text-zinc-900 uppercase">
                  3. Líder de Scanlation
                </strong>
                <span className="bg-purple-700 px-2 py-0.5 text-[10px] font-black text-white uppercase">
                  SCAN LEADER
                </span>
              </div>
              <p className="mt-1 text-[11px] text-zinc-600">
                Administra su propio grupo Scanlation y puede agregar o quitar
                miembros uploaders para su equipo.
              </p>
            </div>

            <div className="border border-zinc-300 bg-zinc-50 p-3">
              <div className="flex items-center justify-between">
                <strong className="text-zinc-900 uppercase">
                  4. Administrador General
                </strong>
                <span className="bg-[#d9381e] px-2 py-0.5 text-[10px] font-black text-white uppercase">
                  ADMIN
                </span>
              </div>
              <p className="mt-1 text-[11px] text-zinc-600">
                Aprueba solicitudes de nuevos Scanlations/Uploaders y verifica
                grupos oficiales.{" "}
                <strong>
                  (La primera cuenta que se registre en la plataforma recibe
                  automáticamente el rol de Administrador General).
                </strong>
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
