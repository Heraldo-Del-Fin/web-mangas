import { cookies } from "next/headers";
import { generateSessionToken } from "./crypto";
import { readDatabase, writeDatabase } from "./data";
import { executeNeonQuery, isNeonConfigured } from "./neon-db";
import { SessionUser } from "./types";

export const SESSION_COOKIE_NAME = "kuramanga_session";

export async function getCurrentSessionUser(): Promise<SessionUser | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (!token) return null;

    const db = await readDatabase();
    const session = db.sessions.find((s) => s.token === token);
    if (!session) return null;

    if (new Date(session.expiresAt).getTime() < Date.now()) {
      return null;
    }

    const user = db.users.find((u) => u.id === session.userId);
    if (!user) return null;

    const memberships = db.scanlationMembers.filter(
      (m) => m.userId === user.id
    );

    const canUpload =
      user.role === "ADMIN" ||
      user.role === "UPLOADER" ||
      memberships.length > 0;

    const isScanLeader =
      user.role === "ADMIN" ||
      memberships.some((m) => m.role === "SCAN_LEADER");

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      memberships,
      canUpload,
      isScanLeader,
    };
  } catch {
    return null;
  }
}

/**
 * Verificación ligera de permisos de subida: una sola consulta SQL a Neon
 * (sessions + users + scanlation_members) en vez de leer toda la base de datos.
 * Pensada para endpoints que se llaman muchas veces seguidas (subida de páginas).
 */
export async function getUploadPermission(): Promise<{
  userId: string;
  role: string;
  scanlationIds: string[];
} | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (!token) return null;

    if (isNeonConfigured()) {
      const res = await executeNeonQuery<{
        id: string;
        role: string;
        scan_ids: string[] | null;
      }>(
        `SELECT u.id, u.role,
                COALESCE((SELECT json_agg(m.scanlation_id) FROM scanlation_members m WHERE m.user_id = u.id), '[]'::json) AS scan_ids
         FROM sessions s
         JOIN users u ON u.id = s.user_id
         WHERE s.token = $1 AND s.expires_at > NOW()
         LIMIT 1;`,
        [token]
      );
      if (res.ok) {
        const row = res.rows[0];
        if (!row) return null;
        const scanlationIds = Array.isArray(row.scan_ids) ? row.scan_ids : [];
        const allowed =
          row.role === "ADMIN" ||
          row.role === "UPLOADER" ||
          scanlationIds.length > 0;
        return allowed
          ? { userId: row.id, role: row.role, scanlationIds }
          : null;
      }
    }

    // Respaldo (desarrollo local sin Neon)
    const user = await getCurrentSessionUser();
    if (!user || !user.canUpload) return null;
    return {
      userId: user.id,
      role: user.role,
      scanlationIds: user.memberships.map((m) => m.scanlationId),
    };
  } catch {
    return null;
  }
}

export async function createSessionForUser(userId: string): Promise<string> {
  const token = generateSessionToken();
  const expiresAt = new Date(
    Date.now() + 1000 * 60 * 60 * 24 * 14
  ).toISOString();

  const db = await readDatabase();
  db.sessions = db.sessions.filter(
    (s) => new Date(s.expiresAt).getTime() > Date.now()
  );
  db.sessions.push({
    token,
    userId,
    expiresAt,
  });
  await writeDatabase(db);

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    expires: new Date(expiresAt),
  });

  return token;
}

export async function destroyCurrentSession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (token) {
    const db = await readDatabase();
    db.sessions = db.sessions.filter((s) => s.token !== token);
    await writeDatabase(db);
  }

  cookieStore.delete(SESSION_COOKIE_NAME);
}

