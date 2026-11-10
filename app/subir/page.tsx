import Link from "next/link";
import { Suspense } from "react";
import { UploadStudio } from "@/components/upload/UploadStudio";
import { getCurrentSessionUser } from "@/lib/auth";
import { getAllMangas, getScanlationGroups } from "@/lib/data";

async function SubirProtectedContent() {
  const [currentUser, mangas, allScanlations] = await Promise.all([
    getCurrentSessionUser(),
    getAllMangas(),
    getScanlationGroups(),
  ]);

  if (!currentUser) {
    return (
      <div className="border-2 border-zinc-300 bg-white p-8 text-center shadow-2xs">
        <span className="border border-amber-500 bg-amber-100 px-2.5 py-0.5 text-[10px] font-black text-amber-900 uppercase">
          Acceso Restringido
        </span>
        <h2 className="mt-2 text-lg font-black text-zinc-900 uppercase">
          Inicia Sesión para Subir Obras o Capítulos
        </h2>
        <p className="mx-auto mt-1 max-w-lg text-xs text-zinc-600">
          Para publicar mangas o capítulos necesitas iniciar sesión con una
          cuenta autorizada como <strong>Uploader</strong>,{" "}
          <strong>Admin de Scanlation</strong> o ser designado por el líder de
          un Scanlation.
        </p>
        <div className="mt-5 flex justify-center gap-3">
          <Link
            href="/login"
            className="border border-[#1e40af] bg-[#1d4ed8] px-5 py-2 text-xs font-extrabold text-white uppercase hover:bg-[#1e40af]"
          >
            Iniciar Sesión / Probar Cuentas »
          </Link>
          <Link
            href="/registro"
            className="border border-zinc-400 bg-zinc-100 px-5 py-2 text-xs font-bold text-zinc-800 uppercase hover:bg-zinc-200"
          >
            Crear Cuenta
          </Link>
        </div>
      </div>
    );
  }

  if (!currentUser.canUpload) {
    return (
      <div className="border-2 border-amber-500 bg-white p-8 text-center shadow-2xs">
        <span className="bg-amber-400 px-2.5 py-0.5 text-[10px] font-black text-zinc-950 uppercase">
          Rol Actual: Usuario Lector Normal (READER)
        </span>
        <h2 className="mt-2 text-lg font-black text-zinc-900 uppercase">
          Tu cuenta aún no tiene permisos de Uploader
        </h2>
        <p className="mx-auto mt-1 max-w-xl text-xs leading-relaxed text-zinc-600">
          Hola <strong>{currentUser.username}</strong>. Para poder subir mangas
          o capítulos necesitas:
          <br />
          1) Enviar una <strong>Solicitud al Administrador General</strong> para
          pasar a Uploader o crear tu Scanlation, o
          <br />
          2) Pedirle al <strong>Líder de un Scanlation</strong> que te designe
          como Uploader de su grupo.
        </p>
        <div className="mt-5 flex justify-center gap-3">
          <Link
            href="/panel"
            className="border border-[#1e40af] bg-[#1d4ed8] px-5 py-2 text-xs font-extrabold text-white uppercase hover:bg-[#1e40af]"
          >
            Solicitar Permiso de Uploader / Crear Scanlation »
          </Link>
          <Link
            href="/login"
            className="border border-zinc-400 bg-zinc-100 px-4 py-2 text-xs font-bold text-zinc-800 uppercase hover:bg-zinc-200"
          >
            Probar con cuenta Uploader / Admin
          </Link>
        </div>
      </div>
    );
  }

  // Filtrar qué Scanlations puede seleccionar este usuario al subir capítulos:
  // Si es un READER designado por un Scanlation, solo ve los Scanlations donde está asignado.
  const allowedScanlations =
    currentUser.role === "ADMIN" || currentUser.role === "UPLOADER"
      ? allScanlations
      : allScanlations.filter((s) =>
          currentUser.memberships.some((m) => m.scanlationId === s.id)
        );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border border-emerald-500 bg-emerald-50/70 px-4 py-2.5 text-xs">
        <div>
          <strong className="text-emerald-950">
            ✓ Conectado como {currentUser.username}
          </strong>{" "}
          <span className="text-emerald-800">
            (
            {currentUser.role === "READER"
              ? `Uploader exclusivo de: ${allowedScanlations
                  .map((s) => s.name)
                  .join(", ")}`
              : `Rol: ${currentUser.role}`}
            )
          </span>
        </div>
        <Link
          href="/panel"
          className="font-extrabold text-[#1d4ed8] hover:underline"
        >
          Gestionar mi Scanlation / Miembros »
        </Link>
      </div>

      <UploadStudio mangas={mangas} scanlations={allowedScanlations} />
    </div>
  );
}

export default function SubirPage() {
  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6">
      <div className="border border-zinc-300 bg-white px-5 py-4 shadow-2xs">
        <span className="border border-zinc-400 bg-zinc-100 px-2 py-0.5 text-[10px] font-extrabold text-zinc-800 uppercase">
          Panel Editorial &amp; Scanlations
        </span>
        <h1 className="mt-2 text-xl font-black tracking-tight text-zinc-900 uppercase sm:text-2xl">
          📤 Publicación de Obras y Capítulos
        </h1>
        <p className="mt-0.5 text-xs text-zinc-600">
          Las imágenes se envían a Cloudflare R2 (o almacenamiento local en
          desarrollo) y los metadatos se indexan en la base de datos.
        </p>
      </div>

      <Suspense
        fallback={
          <div className="border border-zinc-300 bg-white p-10 text-center text-xs font-bold text-zinc-600">
            Verificando permisos de subida...
          </div>
        }
      >
        <SubirProtectedContent />
      </Suspense>
    </main>
  );
}
