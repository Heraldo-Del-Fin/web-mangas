"use server";

import { revalidatePath } from "next/cache";
import {
  createSessionForUser,
  destroyCurrentSession,
  getCurrentSessionUser,
  invalidateSessionUserCache,
} from "./auth";
import { hashPassword, verifyPassword } from "./crypto";
import { PUBLIC_REGISTRATION_ROLE, roleChangeError } from "./security-policy";
import { runtimeVariable } from "./runtime-environment";
import { readDatabase, writeDatabase } from "./data";
import {
  ScanlationMemberRole,
  UploaderRequestType,
  UserRole,
} from "./types";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

export async function registerAction(formData: FormData): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const username = String(formData.get("username") || "").trim();
    const email = String(formData.get("email") || "")
      .trim()
      .toLowerCase();
    const password = String(formData.get("password") || "");

    if (!username || !email || password.length < 5) {
      return {
        success: false,
        error:
          "Completa usuario, correo y una contraseña de al menos 5 caracteres.",
      };
    }

    const db = await readDatabase();
    if (
      db.users.some(
        (u) =>
          u.email.toLowerCase() === email ||
          u.username.toLowerCase() === username.toLowerCase()
      )
    ) {
      return {
        success: false,
        error: "Ese nombre de usuario o correo ya está registrado.",
      };
    }

    const newUser = {
      id: `user-${Date.now()}`,
      username,
      email,
      passwordHash: hashPassword(password),
      role: PUBLIC_REGISTRATION_ROLE,
      bio: "Lector registrado en KuruManga.",
      createdAt: new Date().toISOString(),
    };

    db.users.push(newUser);
    await writeDatabase(db);
    await createSessionForUser(newUser.id);
    revalidatePath("/", "layout");

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error:
        err instanceof Error ? err.message : "Error al registrar la cuenta.",
    };
  }
}

export async function loginAction(formData: FormData): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const identifier = String(formData.get("identifier") || "")
      .trim()
      .toLowerCase();
    const password = String(formData.get("password") || "");

    const db = await readDatabase();
    const user = db.users.find(
      (u) =>
        u.email.toLowerCase() === identifier ||
        u.username.toLowerCase() === identifier
    );

    if (!user || !verifyPassword(password, user.passwordHash)) {
      return {
        success: false,
        error: "Usuario/correo o contraseña incorrectos.",
      };
    }

    await createSessionForUser(user.id);
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Error al iniciar sesión.",
    };
  }
}

export async function logoutAction(): Promise<void> {
  await destroyCurrentSession();
}

export async function submitUploaderRequestAction(
  formData: FormData
): Promise<{
  success: boolean;
  error?: string;
}> {
  const currentUser = await getCurrentSessionUser();
  if (!currentUser) {
    return { success: false, error: "Debes iniciar sesión primero." };
  }

  const type =
    (formData.get("type") as UploaderRequestType) || "BECOME_UPLOADER";
  const reason = String(formData.get("reason") || "").trim();
  const proposedScanName = String(
    formData.get("proposedScanName") || ""
  ).trim();
  const proposedScanDescription = String(
    formData.get("proposedScanDescription") || ""
  ).trim();
  const proposedScanDiscord = String(
    formData.get("proposedScanDiscord") || ""
  ).trim();

  if (!reason) {
    return {
      success: false,
      error: "Explica brevemente el motivo de tu solicitud.",
    };
  }

  if (type === "CREATE_SCANLATION" && !proposedScanName) {
    return {
      success: false,
      error: "Debes indicar el nombre del Scanlation que deseas crear.",
    };
  }

  const db = await readDatabase();
  const existingPending = db.uploaderRequests.find(
    (r) => r.userId === currentUser.id && r.status === "PENDING"
  );
  if (existingPending) {
    return {
      success: false,
      error: "Ya tienes una solicitud pendiente de revisión por un Admin.",
    };
  }

  db.uploaderRequests.unshift({
    id: `req-${Date.now()}`,
    userId: currentUser.id,
    username: currentUser.username,
    userEmail: currentUser.email,
    type,
    reason,
    proposedScanName:
      type === "CREATE_SCANLATION" ? proposedScanName : undefined,
    proposedScanDescription:
      type === "CREATE_SCANLATION" ? proposedScanDescription : undefined,
    proposedScanDiscord:
      type === "CREATE_SCANLATION" ? proposedScanDiscord : undefined,
    status: "PENDING",
    createdAt: new Date().toISOString(),
  });

  await writeDatabase(db);
  return { success: true };
}

export async function reviewUploaderRequestAction(
  requestId: string,
  decision: "APPROVED" | "REJECTED"
): Promise<{
  success: boolean;
  error?: string;
}> {
  const currentUser = await getCurrentSessionUser();
  if (!currentUser || currentUser.role !== "ADMIN") {
    return {
      success: false,
      error: "Solo un Administrador General puede aprobar o rechazar solicitudes.",
    };
  }

  const db = await readDatabase();
  const reqItem = db.uploaderRequests.find((r) => r.id === requestId);
  if (!reqItem) {
    return { success: false, error: "Solicitud no encontrada." };
  }

  reqItem.status = decision;
  reqItem.reviewedBy = currentUser.username;
  reqItem.reviewedAt = new Date().toISOString();

  if (decision === "APPROVED") {
    const targetUser = db.users.find((u) => u.id === reqItem.userId);
    if (targetUser) {
      if (targetUser.role === "READER") {
        targetUser.role = "UPLOADER";
      }

      if (reqItem.type === "CREATE_SCANLATION" && reqItem.proposedScanName) {
        const scanId = `scan-${Date.now()}`;
        const newScan = {
          id: scanId,
          name: reqItem.proposedScanName,
          slug: slugify(reqItem.proposedScanName) || scanId,
          ownerId: targetUser.id,
          verified: false,
          description:
            reqItem.proposedScanDescription ||
            "Scanlation aprobado por la administración.",
          discord: reqItem.proposedScanDiscord,
          membersCount: 1,
          uploadsCount: 0,
        };
        db.scanlations.push(newScan);

        db.scanlationMembers.push({
          id: `sm-${Date.now()}`,
          scanlationId: newScan.id,
          scanlationName: newScan.name,
          userId: targetUser.id,
          username: targetUser.username,
          email: targetUser.email,
          role: "SCAN_LEADER",
          addedAt: new Date().toISOString(),
        });
      }
    }
  }

  await writeDatabase(db);
  revalidatePath("/", "layout");
  return { success: true };
}

/**
 * Permite al Admin de un Scanlation (SCAN_LEADER) o a un ADMIN general
 * designar a un usuario registrado como SCAN_UPLOADER (o SCAN_LEADER)
 * EXCLUSIVAMENTE para su propio Scanlation.
 */
export async function designateScanlationMemberAction(formData: FormData): Promise<{
  success: boolean;
  error?: string;
}> {
  const currentUser = await getCurrentSessionUser();
  if (!currentUser) {
    return { success: false, error: "Debes iniciar sesión." };
  }

  const scanlationId = String(formData.get("scanlationId") || "").trim();
  const userIdentifier = String(formData.get("userIdentifier") || "")
    .trim()
    .toLowerCase();
  const memberRole =
    (formData.get("memberRole") as ScanlationMemberRole) || "SCAN_UPLOADER";

  // Verificar que currentUser sea ADMIN general o SCAN_LEADER de ese Scanlation específico
  const isLeaderOfThisScan = currentUser.memberships.some(
    (m) => m.scanlationId === scanlationId && m.role === "SCAN_LEADER"
  );

  if (currentUser.role !== "ADMIN" && !isLeaderOfThisScan) {
    return {
      success: false,
      error:
        "Solo el Administrador de este Scanlation puede designar Uploaders para su grupo.",
    };
  }

  const db = await readDatabase();
  const scan = db.scanlations.find((s) => s.id === scanlationId);
  if (!scan) {
    return { success: false, error: "El Scanlation indicado no existe." };
  }

  const targetUser = db.users.find(
    (u) =>
      u.username.toLowerCase() === userIdentifier ||
      u.email.toLowerCase() === userIdentifier
  );
  if (!targetUser) {
    return {
      success: false,
      error:
        "No se encontró ningún usuario con ese nombre de usuario o correo.",
    };
  }

  const existing = db.scanlationMembers.find(
    (m) => m.scanlationId === scanlationId && m.userId === targetUser.id
  );

  if (existing) {
    existing.role = memberRole;
  } else {
    db.scanlationMembers.push({
      id: `sm-${Date.now()}`,
      scanlationId: scan.id,
      scanlationName: scan.name,
      userId: targetUser.id,
      username: targetUser.username,
      email: targetUser.email,
      role: memberRole,
      addedAt: new Date().toISOString(),
    });
    scan.membersCount += 1;
  }

  await writeDatabase(db);
  revalidatePath("/", "layout");
  return { success: true };
}

export async function removeScanlationMemberAction(
  membershipId: string
): Promise<{
  success: boolean;
  error?: string;
}> {
  const currentUser = await getCurrentSessionUser();
  if (!currentUser) {
    return { success: false, error: "Debes iniciar sesión." };
  }

  const db = await readDatabase();
  const member = db.scanlationMembers.find((m) => m.id === membershipId);
  if (!member) {
    return { success: false, error: "Miembro no encontrado." };
  }

  const isLeaderOfThisScan = currentUser.memberships.some(
    (m) => m.scanlationId === member.scanlationId && m.role === "SCAN_LEADER"
  );

  if (currentUser.role !== "ADMIN" && !isLeaderOfThisScan) {
    return {
      success: false,
      error: "No tienes permisos para quitar miembros de este Scanlation.",
    };
  }

  db.scanlationMembers = db.scanlationMembers.filter(
    (m) => m.id !== membershipId
  );

  const scan = db.scanlations.find((s) => s.id === member.scanlationId);
  if (scan && scan.membersCount > 1) {
    scan.membersCount -= 1;
  }

  await writeDatabase(db);
  revalidatePath("/", "layout");
  return { success: true };
}

export async function adminChangeUserRoleAction(
  targetUserId: string,
  newRole: UserRole
): Promise<{
  success: boolean;
  error?: string;
}> {
  const currentUser = await getCurrentSessionUser({ fresh: true });
  if (!currentUser || currentUser.role !== "ADMIN") {
    return {
      success: false,
      error: "Solo un Administrador General puede cambiar roles globales.",
    };
  }

  const db = await readDatabase(true);
  const user = db.users.find((u) => u.id === targetUserId);
  if (!user) {
    return { success: false, error: "Usuario no encontrado." };
  }

  const denied = roleChangeError(currentUser.id, user, newRole,
    db.users.filter((u) => u.role === "ADMIN").length, runtimeVariable("PRIMARY_ADMIN_USER_ID"));
  if (denied) return { success: false, error: denied };
  if (user.role === newRole) return { success: true };
  user.role = newRole;
  invalidateSessionUserCache();
  await writeDatabase(db);
  revalidatePath("/", "layout");
  return { success: true };
}

export async function adminToggleVerifyScanlationAction(
  scanlationId: string
): Promise<{
  success: boolean;
  error?: string;
}> {
  const currentUser = await getCurrentSessionUser();
  if (!currentUser || currentUser.role !== "ADMIN") {
    return {
      success: false,
      error: "Solo un Administrador General puede verificar Scanlations.",
    };
  }

  const db = await readDatabase();
  const scan = db.scanlations.find((s) => s.id === scanlationId);
  if (!scan) {
    return { success: false, error: "Scanlation no encontrado." };
  }

  scan.verified = !scan.verified;
  await writeDatabase(db);
  revalidatePath("/", "layout");
  return { success: true };
}

export async function deleteChapterUploadAction(uploadId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  const currentUser = await getCurrentSessionUser();
  if (!currentUser) {
    return { success: false, error: "Debes iniciar sesión." };
  }

  const db = await readDatabase();
  for (const manga of db.mangas) {
    for (const ch of manga.chapters) {
      const idx = ch.uploads.findIndex((u) => u.id === uploadId);
      if (idx !== -1) {
        const up = ch.uploads[idx];
        const isLeaderOfScan = currentUser.memberships.some(
          (m) => m.scanlationId === up.scanlationId && m.role === "SCAN_LEADER"
        );
        const isUploader = up.uploaderId === currentUser.id;

        if (
          currentUser.role !== "ADMIN" &&
          !isLeaderOfScan &&
          !isUploader
        ) {
          return {
            success: false,
            error: "No tienes permisos para eliminar este capítulo.",
          };
        }

        ch.uploads.splice(idx, 1);
        if (ch.uploads.length === 0) {
          manga.chapters = manga.chapters.filter((c) => c.id !== ch.id);
        }
        await writeDatabase(db);
        revalidatePath("/", "layout");
        return { success: true };
      }
    }
  }

  return { success: false, error: "Capítulo no encontrado." };
}

