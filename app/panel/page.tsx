import { redirect } from "next/navigation";
import { Suspense } from "react";
import { RoleControlPanel } from "@/components/auth/RoleControlPanel";
import { getCurrentSessionUser } from "@/lib/auth";
import { readDatabase } from "@/lib/data";
import { getCloudInfrastructureStatus } from "@/lib/neon-db";

async function PanelContent() {
  const currentUser = await getCurrentSessionUser();
  if (!currentUser) {
    redirect("/login");
  }

  const db = await readDatabase();
  const safeUsers = db.users.map(({ passwordHash: _, ...rest }) => rest);
  const cloudStatus = getCloudInfrastructureStatus();

  return (
    <div className="space-y-6">
      {/* Estado de Infraestructura Cloud (Neon PostgreSQL + Cloudflare R2) */}
      <section className="border border-zinc-300 bg-white p-4 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="bg-zinc-900 px-2 py-0.5 text-[10px] font-black text-white uppercase">
              Infraestructura Cloud
            </span>
            <span className="text-xs font-extrabold text-zinc-900 uppercase">
              Estado de Conexión Base de Datos &amp; Storage
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span
              className={`border px-2.5 py-1 font-bold ${
                cloudStatus.neonConfigured
                  ? "border-emerald-600 bg-emerald-50 text-emerald-900"
                  : "border-amber-500 bg-amber-50 text-amber-900"
              }`}
            >
              {cloudStatus.neonConfigured
                ? `✓ Neon PostgreSQL (${cloudStatus.neonDatabaseName})`
                : "○ Neon (Modo Local)"}
            </span>

            <span
              className={`border px-2.5 py-1 font-bold ${
                cloudStatus.r2Configured
                  ? "border-emerald-600 bg-emerald-50 text-emerald-900"
                  : "border-amber-500 bg-amber-50 text-amber-900"
              }`}
            >
              {cloudStatus.r2Configured
                ? `✓ Cloudflare R2 (Bucket: ${cloudStatus.r2Bucket})`
                : "○ Cloudflare R2 (Modo Local)"}
            </span>
          </div>
        </div>
      </section>

      <RoleControlPanel
        currentUser={currentUser}
        allRequests={db.uploaderRequests}
        allScanlations={db.scanlations}
        allMembers={db.scanlationMembers}
        allUsers={safeUsers}
        allMangas={db.mangas}
      />
    </div>
  );
}

export default function PanelPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <Suspense
        fallback={
          <div className="border border-zinc-300 bg-white p-10 text-center text-xs font-bold text-zinc-600">
            Cargando panel de permisos y cuenta...
          </div>
        }
      >
        <PanelContent />
      </Suspense>
    </main>
  );
}
