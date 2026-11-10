"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { registerAction } from "@/lib/auth-actions";

export default function RegistroPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const res = await registerAction(formData);
    setLoading(false);

    if (!res.success) {
      setError(res.error || "No se pudo crear la cuenta.");
      return;
    }

    router.push("/panel");
    router.refresh();
  };

  return (
    <main className="mx-auto max-w-xl px-4 py-10 sm:px-6">
      <div className="border border-zinc-300 bg-white p-6 shadow-2xs">
        <div className="border-b-2 border-zinc-300 pb-3">
          <span className="border border-zinc-400 bg-zinc-100 px-2 py-0.5 text-[10px] font-extrabold text-zinc-800 uppercase">
            Registro en KuraManga
          </span>
          <h1 className="mt-1.5 text-xl font-black text-zinc-900 uppercase">
            Crear Nueva Cuenta
          </h1>
        </div>

        {/* Nota de reglas de permisos */}
        <div className="mt-4 border border-blue-300 bg-blue-50/70 p-3.5 text-xs leading-relaxed text-zinc-800">
          <strong className="block font-extrabold text-[#1d4ed8] uppercase">
            ℹ️ ¿Cómo funcionan los permisos para subir mangas?
          </strong>
          Todas las cuentas nuevas se crean como{" "}
          <strong>Usuario Lector Normal (READER)</strong>. Una vez dentro de tu
          cuenta podrás:
          <ul className="mt-1.5 list-inside list-disc space-y-1 text-[11px] text-zinc-700">
            <li>
              Enviar una <strong>Solicitud al Administrador</strong> para
              convertirte en <strong>Uploader</strong> o fundar tu propio{" "}
              <strong>Scanlation</strong>.
            </li>
            <li>
              O pedirle al <strong>Administrador de un Scanlation</strong>{" "}
              existente que te designe como <strong>Uploader exclusivo</strong>{" "}
              de su grupo.
            </li>
          </ul>
        </div>

        {error && (
          <div className="mt-4 border border-rose-500 bg-rose-50 p-3 text-xs font-bold text-rose-800">
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label className="mb-1 block text-xs font-extrabold text-zinc-800 uppercase">
              Nombre de Usuario (Nick) *
            </label>
            <input
              type="text"
              name="username"
              required
              placeholder="Ej: KenjiManga"
              className="w-full rounded-none border border-zinc-400 bg-zinc-50 px-3 py-2 text-xs font-semibold text-zinc-900 focus:border-[#1d4ed8] focus:bg-white focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-extrabold text-zinc-800 uppercase">
              Correo Electrónico *
            </label>
            <input
              type="email"
              name="email"
              required
              placeholder="tu@correo.com"
              className="w-full rounded-none border border-zinc-400 bg-zinc-50 px-3 py-2 text-xs font-semibold text-zinc-900 focus:border-[#1d4ed8] focus:bg-white focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-extrabold text-zinc-800 uppercase">
              Contraseña (mínimo 5 caracteres) *
            </label>
            <input
              type="password"
              name="password"
              required
              minLength={5}
              placeholder="••••••••"
              className="w-full rounded-none border border-zinc-400 bg-zinc-50 px-3 py-2 text-xs font-semibold text-zinc-900 focus:border-[#1d4ed8] focus:bg-white focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full border border-[#1e40af] bg-[#1d4ed8] py-2.5 text-xs font-extrabold tracking-wider text-white uppercase hover:bg-[#1e40af] disabled:opacity-50"
          >
            {loading ? "Creando cuenta..." : "Registrar Cuenta de Lector »"}
          </button>
        </form>

        <div className="mt-5 border-t border-zinc-200 pt-4 text-center text-xs text-zinc-600">
          ¿Ya tienes una cuenta?{" "}
          <Link
            href="/login"
            className="font-extrabold text-[#1d4ed8] hover:underline"
          >
            Inicia Sesión aquí »
          </Link>
        </div>
      </div>
    </main>
  );
}

