import { cookies } from "next/headers";
import { generateSessionToken } from "./crypto";
import { readDatabase, writeDatabase } from "./data";
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

