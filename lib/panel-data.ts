import type { DatabaseSchema } from "./data";
import type { Manga, SessionUser } from "./types";

export type PanelManga = Pick<Manga, "id" | "slug" | "title" | "coverUrl" | "type" | "status"> & { chapterCount: number };

// Explicit server-side projection: never serialize the database snapshot.
export function selectPanelData(db: DatabaseSchema, viewer: SessionUser) {
  const admin = viewer.role === "ADMIN";
  const managed = new Set(viewer.memberships.filter((m) => m.role === "SCAN_LEADER").map((m) => m.scanlationId));
  return {
    allRequests: db.uploaderRequests.filter((r) => admin || r.userId === viewer.id),
    allScanlations: db.scanlations.filter((s) => admin || managed.has(s.id)),
    allMembers: db.scanlationMembers.filter((m) => admin || managed.has(m.scanlationId)).map((m) => ({
      id: m.id, scanlationId: m.scanlationId, scanlationName: m.scanlationName,
      userId: m.userId, username: m.username, email: admin ? m.email : "",
      role: m.role, addedAt: m.addedAt,
    })),
    allUsers: admin ? db.users.map((u) => ({
      id: u.id, username: u.username, email: u.email, role: u.role, bio: u.bio, createdAt: u.createdAt,
    })) : [],
    allMangas: viewer.canUpload ? db.mangas.map((m): PanelManga => ({
      id: m.id, slug: m.slug, title: m.title, coverUrl: m.coverUrl, type: m.type,
      status: m.status, chapterCount: m.chapters.length,
    })) : [],
  };
}
