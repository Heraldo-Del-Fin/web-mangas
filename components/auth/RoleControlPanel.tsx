"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import {
  adminChangeUserRoleAction,
  adminToggleVerifyScanlationAction,
  designateScanlationMemberAction,
  removeScanlationMemberAction,
  reviewUploaderRequestAction,
  submitUploaderRequestAction,
} from "@/lib/auth-actions";
import {
  ScanlationGroup,
  ScanlationMember,
  SessionUser,
  UploaderRequest,
  UploaderRequestType,
  USER_ROLES,
  UserAccount,
  UserRole,
} from "@/lib/types";

export function RoleControlPanel({
  currentUser,
  allRequests,
  allScanlations,
  allMembers,
  allUsers,
}: {
  currentUser: SessionUser;
  allRequests: UploaderRequest[];
  allScanlations: ScanlationGroup[];
  allMembers: ScanlationMember[];
  allUsers: Omit<UserAccount, "passwordHash">[];
}) {
  const router = useRouter();
  const [reqType, setReqType] =
    useState<UploaderRequestType>("CREATE_SCANLATION");
  const [feedback, setFeedback] = useState<{
    type: "ok" | "err";
    text: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  const myRequests = allRequests.filter((r) => r.userId === currentUser.id);
  const pendingAdminRequests = allRequests.filter(
    (r) => r.status === "PENDING"
  );

  // Scanlations que este usuario puede administrar (si es ADMIN puede administrar todos; si es SCAN_LEADER solo los suyos)
  const managedScanlations =
    currentUser.role === "ADMIN"
      ? allScanlations
      : allScanlations.filter((s) =>
          currentUser.memberships.some(
            (m) => m.scanlationId === s.id && m.role === "SCAN_LEADER"
          )
        );

  const handleRequestSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setFeedback(null);
    const formData = new FormData(e.currentTarget);
    formData.set("type", reqType);

    const res = await submitUploaderRequestAction(formData);
    setLoading(false);

    if (!res.success) {
      setFeedback({ type: "err", text: res.error || "Error al enviar." });
      return;
    }

    setFeedback({
      type: "ok",
      text: "✓ Solicitud enviada correctamente. Un Administrador revisará tu petición.",
    });
    router.refresh();
  };

  const handleReviewRequest = async (
    requestId: string,
    decision: "APPROVED" | "REJECTED"
  ) => {
    setLoading(true);
    setFeedback(null);
    const res = await reviewUploaderRequestAction(requestId, decision);
    setLoading(false);

    if (!res.success) {
      setFeedback({ type: "err", text: res.error || "Error al procesar." });
      return;
    }
    setFeedback({
      type: "ok",
      text:
        decision === "APPROVED"
          ? "✓ Solicitud aprobada y permisos otorgados."
          : "Solicitud rechazada.",
    });
    router.refresh();
  };

  const handleDesignateMember = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setFeedback(null);
    const formData = new FormData(e.currentTarget);
    const res = await designateScanlationMemberAction(formData);
    setLoading(false);

    if (!res.success) {
      setFeedback({ type: "err", text: res.error || "No se pudo designar." });
      return;
    }

    setFeedback({
      type: "ok",
      text: "✓ Usuario designado correctamente en el Scanlation.",
    });
    router.refresh();
  };

  const handleRemoveMember = async (membershipId: string) => {
    setLoading(true);
    const res = await removeScanlationMemberAction(membershipId);
    setLoading(false);
    if (res.success) {
      setFeedback({
        type: "ok",
        text: "Permiso de miembro revocado del Scanlation.",
      });
      router.refresh();
    }
  };

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    setLoading(true);
    const res = await adminChangeUserRoleAction(userId, newRole);
    setLoading(false);
    if (res.success) {
      setFeedback({
        type: "ok",
        text: "✓ Rol global actualizado correctamente.",
      });
      router.refresh();
    }
  };

  const handleToggleVerifyScan = async (scanlationId: string) => {
    setLoading(true);
    const res = await adminToggleVerifyScanlationAction(scanlationId);
    setLoading(false);
    if (res.success) {
      setFeedback({
        type: "ok",
        text: "✓ Estado de verificación del Scanlation actualizado.",
      });
      router.refresh();
    }
  };

  return (
    <div className="space-y-8">
      {/* Resumen de Cuenta Actual */}
      <section className="border border-zinc-300 bg-white p-5 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b-2 border-zinc-300 pb-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-black text-zinc-900 uppercase">
                👤 Cuenta: {currentUser.username}
              </h1>
              <span
                className={`border px-2 py-0.5 text-xs font-extrabold uppercase ${
                  USER_ROLES[currentUser.role].badgeClass
                }`}
              >
                Rol Global: {USER_ROLES[currentUser.role].label}
              </span>
            </div>
            <p className="mt-1 text-xs text-zinc-600">
              Correo: <strong>{currentUser.email}</strong> •{" "}
              { USER_ROLES[currentUser.role].description }
            </p>
          </div>

          <div className="flex items-center gap-2">
            {currentUser.canUpload && (
              <Link
                href="/subir"
                className="border border-[#1e40af] bg-[#1d4ed8] px-4 py-2 text-xs font-extrabold text-white uppercase hover:bg-[#1e40af]"
              >
                + Ir a Subir Manga / Capítulo »
              </Link>
            )}
            <Link
              href="/login"
              className="border border-zinc-400 bg-zinc-100 px-3 py-2 text-xs font-bold text-zinc-800 hover:bg-zinc-200"
            >
              Cambiar de Cuenta
            </Link>
          </div>
        </div>

        {/* Membresías en Scanlations del usuario */}
        <div className="mt-4">
          <h2 className="text-xs font-black tracking-wider text-zinc-800 uppercase">
            🛡️ Mis Permisos en Grupos Scanlation:
          </h2>
          {currentUser.memberships.length === 0 ? (
            <p className="mt-1 text-xs text-zinc-600">
              Actualmente no perteneces a ningún Scanlation específico.
            </p>
          ) : (
            <div className="mt-2 flex flex-wrap gap-2">
              {currentUser.memberships.map((m) => (
                <div
                  key={m.id}
                  className="inline-flex items-center gap-2 border border-zinc-300 bg-zinc-50 px-3 py-1.5 text-xs"
                >
                  <strong className="text-zinc-900">{m.scanlationName}</strong>
                  <span
                    className={`px-1.5 py-0.5 text-[10px] font-black text-white uppercase ${
                      m.role === "SCAN_LEADER"
                        ? "bg-purple-700"
                        : "bg-emerald-700"
                    }`}
                  >
                    {m.role === "SCAN_LEADER"
                      ? "ADMIN DEL SCANLATION"
                      : "UPLOADER EXCLUSIVO DEL SCAN"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {feedback && (
        <div
          className={`border p-3.5 text-xs font-bold ${
            feedback.type === "ok"
              ? "border-emerald-600 bg-emerald-50 text-emerald-900"
              : "border-rose-500 bg-rose-50 text-rose-800"
          }`}
        >
          {feedback.text}
        </div>
      )}

      {/* =====================================================================
          SECCIÓN 1 (PARA ADMIN GENERAL): APROBAR SOLICITUDES Y ROLES GLOBALES
      ===================================================================== */}
      {currentUser.role === "ADMIN" && (
        <section className="space-y-6 border-2 border-[#d9381e] bg-white p-5 shadow-2xs">
          <div className="border-b-2 border-zinc-300 pb-3">
            <span className="bg-[#d9381e] px-2 py-0.5 text-[10px] font-black text-white uppercase">
              Exclusivo Administrador General
            </span>
            <h2 className="mt-1.5 text-lg font-black text-zinc-900 uppercase">
              1. Bandeja de Solicitudes de Uploaders y Nuevos Scanlations (
              {pendingAdminRequests.length} pendientes)
            </h2>
            <p className="text-xs text-zinc-600">
              Aprueba o rechaza las peticiones de usuarios normales (READER)
              para pasar a Uploader o fundar un Scanlation.
            </p>
          </div>

          {allRequests.length === 0 ? (
            <p className="text-xs text-zinc-500">
              No hay solicitudes registradas.
            </p>
          ) : (
            <div className="divide-y divide-zinc-200 border border-zinc-300">
              {allRequests.map((req) => (
                <div
                  key={req.id}
                  className="flex flex-col justify-between gap-4 p-4 sm:flex-row sm:items-center"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`px-2 py-0.5 text-[10px] font-black uppercase ${
                          req.status === "PENDING"
                            ? "bg-amber-400 text-zinc-950"
                            : req.status === "APPROVED"
                              ? "bg-emerald-700 text-white"
                              : "bg-zinc-600 text-white"
                        }`}
                      >
                        {req.status === "PENDING"
                          ? "PENDIENTE"
                          : req.status === "APPROVED"
                            ? "APROBADA"
                            : "RECHAZADA"}
                      </span>
                      <span className="border border-zinc-400 bg-zinc-100 px-2 py-0.5 text-[10px] font-extrabold text-zinc-800 uppercase">
                        {req.type === "CREATE_SCANLATION"
                          ? "Fundar Scanlation + Uploader"
                          : "Pasar a Uploader"}
                      </span>
                      <strong className="text-xs text-zinc-900">
                        Usuario: {req.username} ({req.userEmail})
                      </strong>
                    </div>

                    {req.proposedScanName && (
                      <p className="text-xs font-extrabold text-[#1d4ed8]">
                        Scanlation propuesto: «{req.proposedScanName}» —{" "}
                        <span className="font-normal text-zinc-600">
                          {req.proposedScanDescription}
                        </span>
                      </p>
                    )}

                    <p className="text-xs text-zinc-700">
                      <strong>Motivo:</strong> {req.reason}
                    </p>
                  </div>

                  {req.status === "PENDING" ? (
                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        disabled={loading}
                        onClick={() => handleReviewRequest(req.id, "APPROVED")}
                        className="border border-emerald-800 bg-emerald-700 px-3.5 py-1.5 text-xs font-extrabold text-white uppercase hover:bg-emerald-800"
                      >
                        ✓ Aprobar
                      </button>
                      <button
                        type="button"
                        disabled={loading}
                        onClick={() => handleReviewRequest(req.id, "REJECTED")}
                        className="border border-rose-800 bg-rose-700 px-3.5 py-1.5 text-xs font-extrabold text-white uppercase hover:bg-rose-800"
                      >
                        ✕ Rechazar
                      </button>
                    </div>
                  ) : (
                    <span className="text-[11px] font-semibold text-zinc-500">
                      Revisado por {req.reviewedBy}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Gestión directa de roles de usuarios */}
          <div className="border-t border-zinc-300 pt-4">
            <h3 className="mb-2 text-xs font-black tracking-wider text-zinc-900 uppercase">
              Directorio de Cuentas y Cambio Directo de Rol Global:
            </h3>
            <div className="divide-y divide-zinc-200 border border-zinc-300 bg-zinc-50">
              {allUsers.map((u) => (
                <div
                  key={u.id}
                  className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2 text-xs"
                >
                  <div>
                    <strong className="text-zinc-900">{u.username}</strong>{" "}
                    <span className="text-zinc-500">({u.email})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-zinc-600">
                      Rol global:
                    </span>
                    <select
                      value={u.role}
                      onChange={(e) =>
                        handleRoleChange(u.id, e.target.value as UserRole)
                      }
                      className="rounded-none border border-zinc-400 bg-white px-2 py-1 text-xs font-extrabold text-zinc-900"
                    >
                      <option value="READER">READER (Lector Normal)</option>
                      <option value="UPLOADER">
                        UPLOADER (Subidor Autorizado)
                      </option>
                      <option value="ADMIN">ADMIN (Administrador)</option>
                    </select>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Verificación de Grupos Scanlation */}
          <div className="border-t border-zinc-300 pt-4">
            <h3 className="mb-2 text-xs font-black tracking-wider text-zinc-900 uppercase">
              Verificación Oficial de Grupos Scanlation:
            </h3>
            <div className="divide-y divide-zinc-200 border border-zinc-300 bg-zinc-50">
              {allScanlations.map((s) => (
                <div
                  key={s.id}
                  className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2 text-xs"
                >
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/grupos/${s.slug}`}
                      className="font-extrabold text-zinc-900 hover:text-[#1d4ed8]"
                    >
                      {s.name}
                    </Link>
                    <span className="text-[11px] text-zinc-500">
                      ({s.uploadsCount} caps • {s.membersCount} miembros)
                    </span>
                  </div>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => handleToggleVerifyScan(s.id)}
                    className={`border px-2.5 py-1 text-[11px] font-extrabold uppercase ${
                      s.verified
                        ? "border-emerald-700 bg-emerald-700 text-white hover:bg-emerald-800"
                        : "border-zinc-400 bg-white text-zinc-700 hover:bg-zinc-200"
                    }`}
                  >
                    {s.verified ? "✓ Verificado (Quitar)" : "Marcar Verificado"}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* =====================================================================
          SECCIÓN 2 (PARA ADMINS DE SCANLATION): DESIGNAR UPLOADERS EN SU GRUPO
      ===================================================================== */}
      {managedScanlations.length > 0 && (
        <section className="space-y-5 border-2 border-purple-700 bg-white p-5 shadow-2xs">
          <div className="border-b-2 border-zinc-300 pb-3">
            <span className="bg-purple-700 px-2 py-0.5 text-[10px] font-black text-white uppercase">
              Administración de Scanlation
            </span>
            <h2 className="mt-1.5 text-lg font-black text-zinc-900 uppercase">
              Designar Uploaders Exclusivos para mi Scanlation
            </h2>
            <p className="text-xs text-zinc-600">
              Como Administrador de un Scanlation puedes autorizar a cualquier
              usuario normal (<code>READER</code>) para que suba capítulos{" "}
              <strong>únicamente en nombre de tu Scanlation</strong>.
            </p>
          </div>

          <form
            onSubmit={handleDesignateMember}
            className="grid grid-cols-1 gap-3 border border-zinc-300 bg-zinc-50 p-4 sm:grid-cols-4"
          >
            <div>
              <label className="mb-1 block text-[11px] font-extrabold text-zinc-800 uppercase">
                Tu Scanlation
              </label>
              <select
                name="scanlationId"
                className="w-full rounded-none border border-zinc-400 bg-white px-2.5 py-2 text-xs font-bold text-zinc-900"
              >
                {managedScanlations.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="mb-1 block text-[11px] font-extrabold text-zinc-800 uppercase">
                Usuario o Correo a Designar (Ej: LectorClasico)
              </label>
              <input
                type="text"
                name="userIdentifier"
                required
                placeholder="Escribe su username o correo (ej: LectorClasico)"
                className="w-full rounded-none border border-zinc-400 bg-white px-3 py-2 text-xs font-semibold text-zinc-900"
              />
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-extrabold text-zinc-800 uppercase">
                Cargo en el Scan
              </label>
              <div className="flex gap-1.5">
                <select
                  name="memberRole"
                  defaultValue="SCAN_UPLOADER"
                  className="w-full rounded-none border border-zinc-400 bg-white px-2 py-2 text-xs font-bold text-zinc-900"
                >
                  <option value="SCAN_UPLOADER">Uploader del Scan</option>
                  <option value="SCAN_LEADER">Co-Líder (Admin)</option>
                </select>
                <button
                  type="submit"
                  disabled={loading}
                  className="shrink-0 border border-purple-900 bg-purple-700 px-3 py-2 text-xs font-extrabold text-white uppercase hover:bg-purple-800"
                >
                  + Asignar
                </button>
              </div>
            </div>
          </form>

          {/* Lista de miembros designados por Scanlation */}
          <div className="space-y-3">
            <h3 className="text-xs font-black tracking-wider text-zinc-800 uppercase">
              Miembros Autorizados en tus Scanlations:
            </h3>
            <div className="divide-y divide-zinc-200 border border-zinc-300">
              {allMembers
                .filter((m) =>
                  managedScanlations.some((s) => s.id === m.scanlationId)
                )
                .map((m) => (
                  <div
                    key={m.id}
                    className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-xs"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="border border-zinc-400 bg-zinc-100 px-2 py-0.5 font-extrabold text-zinc-900">
                        {m.scanlationName}
                      </span>
                      <strong className="text-zinc-900">{m.username}</strong>
                      <span className="text-zinc-500">({m.email})</span>
                      <span
                        className={`px-2 py-0.5 text-[10px] font-black text-white uppercase ${
                          m.role === "SCAN_LEADER"
                            ? "bg-purple-700"
                            : "bg-emerald-700"
                        }`}
                      >
                        {m.role === "SCAN_LEADER"
                          ? "Admin de Scanlation"
                          : "Uploader solo de este Scan"}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveMember(m.id)}
                      className="border border-rose-300 bg-rose-50 px-2.5 py-1 text-[11px] font-bold text-rose-800 hover:bg-rose-100"
                    >
                      Quitar del Scanlation ✕
                    </button>
                  </div>
                ))}
            </div>
          </div>
        </section>
      )}

      {/* =====================================================================
          SECCIÓN 3 (PARA USUARIOS READER): SOLICITAR SER UPLOADER O CREAR SCAN
      ===================================================================== */}
      <section className="border border-zinc-300 bg-white p-5 shadow-2xs">
        <div className="border-b-2 border-zinc-300 pb-3">
          <span className="border border-zinc-400 bg-zinc-100 px-2 py-0.5 text-[10px] font-extrabold text-zinc-800 uppercase">
            Solicitudes a Administración
          </span>
          <h2 className="mt-1.5 text-base font-black text-zinc-900 uppercase">
            Solicitar Permiso de Uploader o Fundar un Nuevo Scanlation
          </h2>
          <p className="text-xs text-zinc-600">
            Para pasar de cuenta normal (<code>READER</code>) a{" "}
            <code>UPLOADER</code> o registrar un nuevo grupo Scanlation, envía
            esta solicitud para que un Administrador General la apruebe.
          </p>
        </div>

        <form onSubmit={handleRequestSubmit} className="mt-4 space-y-4">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setReqType("CREATE_SCANLATION")}
              className={`border p-3 text-left text-xs transition ${
                reqType === "CREATE_SCANLATION"
                  ? "border-[#1d4ed8] bg-blue-50/70 font-extrabold text-[#1d4ed8]"
                  : "border-zinc-300 bg-zinc-50 font-bold text-zinc-700"
              }`}
            >
              🛡️ Opción A: Solicitar Crear un Nuevo Scanlation (y ser su Líder)
            </button>
            <button
              type="button"
              onClick={() => setReqType("BECOME_UPLOADER")}
              className={`border p-3 text-left text-xs transition ${
                reqType === "BECOME_UPLOADER"
                  ? "border-[#1d4ed8] bg-blue-50/70 font-extrabold text-[#1d4ed8]"
                  : "border-zinc-300 bg-zinc-50 font-bold text-zinc-700"
              }`}
            >
              📤 Opción B: Solicitar Permiso de Uploader Individual
            </button>
          </div>

          {reqType === "CREATE_SCANLATION" && (
            <div className="grid grid-cols-1 gap-4 border border-zinc-300 bg-zinc-50 p-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-extrabold text-zinc-800 uppercase">
                  Nombre del Scanlation a Crear *
                </label>
                <input
                  type="text"
                  name="proposedScanName"
                  required
                  placeholder="Ej: Olympus Scanlation"
                  className="w-full rounded-none border border-zinc-400 bg-white px-3 py-1.5 text-xs font-bold text-zinc-900"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-extrabold text-zinc-800 uppercase">
                  Discord o Web del Grupo (Opcional)
                </label>
                <input
                  type="text"
                  name="proposedScanDiscord"
                  placeholder="Ej: discord.gg/olympus"
                  className="w-full rounded-none border border-zinc-400 bg-white px-3 py-1.5 text-xs text-zinc-900"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-extrabold text-zinc-800 uppercase">
                  Descripción del Scanlation
                </label>
                <input
                  type="text"
                  name="proposedScanDescription"
                  placeholder="Ej: Traducción de manhwas de acción y fantasía al español..."
                  className="w-full rounded-none border border-zinc-400 bg-white px-3 py-1.5 text-xs text-zinc-900"
                />
              </div>
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs font-extrabold text-zinc-800 uppercase">
              Motivo de la Solicitud / Obras que planeas subir *
            </label>
            <textarea
              name="reason"
              required
              rows={3}
              placeholder="Cuéntanos al Admin qué proyectos deseas traducir o subir..."
              className="w-full rounded-none border border-zinc-400 bg-white p-3 text-xs text-zinc-900"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="border border-[#1e40af] bg-[#1d4ed8] px-5 py-2 text-xs font-extrabold text-white uppercase hover:bg-[#1e40af] disabled:opacity-50"
          >
            Enviar Solicitud al Administrador »
          </button>
        </form>

        {/* Historial de solicitudes propias */}
        {myRequests.length > 0 && (
          <div className="mt-6 border-t border-zinc-200 pt-4">
            <h3 className="mb-2 text-xs font-black text-zinc-800 uppercase">
              Estado de mis Solicitudes Enviadas:
            </h3>
            <div className="divide-y divide-zinc-200 border border-zinc-300 bg-zinc-50">
              {myRequests.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between px-3.5 py-2 text-xs"
                >
                  <div>
                    <strong>
                      {r.type === "CREATE_SCANLATION"
                        ? `Crear Scanlation: ${r.proposedScanName}`
                        : "Solicitud de Uploader"}
                    </strong>{" "}
                    — <span className="text-zinc-600">{r.reason}</span>
                  </div>
                  <span
                    className={`px-2 py-0.5 text-[10px] font-black uppercase ${
                      r.status === "PENDING"
                        ? "bg-amber-400 text-zinc-950"
                        : r.status === "APPROVED"
                          ? "bg-emerald-700 text-white"
                          : "bg-rose-700 text-white"
                    }`}
                  >
                    {r.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

