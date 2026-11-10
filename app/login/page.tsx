"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { loginAction, quickDemoLoginAction } from "@/lib/auth-actions";

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

  const handleQuickLogin = async (email: string) => {
    setLoading(true);
    setError(null);
    const res = await quickDemoLoginAction(email);
    setLoading(false);

    if (res.success) {
      router.push("/panel");
      router.refresh();
    } else {
      setError(res.error || "No se pudo entrar con la cuenta de prueba.");
    }
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
                placeholder="Ej: AdminKura o admin@kuramanga.com"
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
              Regístrate como Lector aquí »
            </Link>
          </div>
        </div>

        {/* Columna Derecha: Acceso Rápido de Prueba por Rol */}
        <div className="border border-zinc-300 bg-white p-6 shadow-2xs">
          <div className="border-b-2 border-zinc-300 pb-3">
            <span className="border border-amber-500 bg-amber-100 px-2 py-0.5 text-[10px] font-extrabold text-amber-900 uppercase">
              Modo Prueba de Roles
            </span>
            <h2 className="mt-1.5 text-base font-black text-zinc-900 uppercase">
              Probar los 4 Niveles de Permisos en 1 Clic
            </h2>
            <p className="mt-0.5 text-xs text-zinc-600">
              Haz clic en cualquiera de estas cuentas preconfiguradas para
              probar cómo funciona cada rol:
            </p>
          </div>

          <div className="mt-4 space-y-2.5">
            <button
              type="button"
              onClick={() => handleQuickLogin("admin@kuramanga.com")}
              className="w-full border border-zinc-300 bg-zinc-50 p-3 text-left transition hover:border-[#d9381e] hover:bg-rose-50/40"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-zinc-900">
                  1. AdminKura (admin@kuramanga.com)
                </span>
                <span className="bg-[#d9381e] px-2 py-0.5 text-[10px] font-black text-white uppercase">
                  ADMIN GENERAL
                </span>
              </div>
              <p className="mt-1 text-[11px] text-zinc-600">
                Aprueba o rechaza solicitudes de nuevos Scanlations/Uploaders y
                modera todo el catálogo. (Clave: <code>admin123</code>)
              </p>
            </button>

            <button
              type="button"
              onClick={() => handleQuickLogin("lider@ragnarok.com")}
              className="w-full border border-zinc-300 bg-zinc-50 p-3 text-left transition hover:border-purple-700 hover:bg-purple-50/40"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-zinc-900">
                  2. LiderRagnarok (lider@ragnarok.com)
                </span>
                <span className="bg-purple-700 px-2 py-0.5 text-[10px] font-black text-white uppercase">
                  ADMIN DE SCANLATION
                </span>
              </div>
              <p className="mt-1 text-[11px] text-zinc-600">
                Líder de <strong>Ragnarok Scanlation</strong>. Puede designar a
                usuarios normales como Uploaders exclusivos de su Scanlation.
                (Clave: <code>scan123</code>)
              </p>
            </button>

            <button
              type="button"
              onClick={() => handleQuickLogin("uploader@nocturne.com")}
              className="w-full border border-zinc-300 bg-zinc-50 p-3 text-left transition hover:border-emerald-700 hover:bg-emerald-50/40"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-zinc-900">
                  3. TraductorNocturne (uploader@nocturne.com)
                </span>
                <span className="bg-emerald-700 px-2 py-0.5 text-[10px] font-black text-white uppercase">
                  UPLOADER DE UN SCAN
                </span>
              </div>
              <p className="mt-1 text-[11px] text-zinc-600">
                Usuario designado solo por{" "}
                <strong>Nocturne Traducciones</strong>. Solo puede subir
                capítulos para ese Scanlation. (Clave: <code>scan123</code>)
              </p>
            </button>

            <button
              type="button"
              onClick={() => handleQuickLogin("lector@kuramanga.com")}
              className="w-full border border-zinc-300 bg-zinc-50 p-3 text-left transition hover:border-zinc-700 hover:bg-zinc-100"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-zinc-900">
                  4. LectorClasico (lector@kuramanga.com)
                </span>
                <span className="border border-zinc-400 bg-zinc-200 px-2 py-0.5 text-[10px] font-black text-zinc-800 uppercase">
                  LECTOR NORMAL
                </span>
              </div>
              <p className="mt-1 text-[11px] text-zinc-600">
                No puede subir directamente; debe enviar solicitud a un Admin o
                ser agregado por un líder de Scanlation. (Clave:{" "}
                <code>lector123</code>)
              </p>
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}

