import fs from "node:fs/promises";
import path from "node:path";
import { connection } from "next/server";
import { isLocalTest, isProductionRuntime, isTestEnvironment } from "./runtime-environment";
import {
  atomicIncrementViews,
  ensureNeonStoreTable,
  executeNeonQuery,
  isNeonConfigured,
} from "./neon-db";
import {
  Chapter,
  ChapterUpload,
  Demography,
  Manga,
  MangaComment,
  ScanlationGroup,
  ScanlationMember,
  UploaderRequest,
  UserAccount,
  UserLibraryRecord,
  UserSession,
  WorkStatus,
  WorkType,
} from "./types";

export interface DatabaseSchema {
  mangas: Manga[];
  scanlations: ScanlationGroup[];
  users: UserAccount[];
  sessions: UserSession[];
  scanlationMembers: ScanlationMember[];
  uploaderRequests: UploaderRequest[];
  userLibrary: UserLibraryRecord[];
}

interface RelationalSnapshot {
  users?: UserAccount[];
  sessions?: UserSession[];
  scanlations?: ScanlationGroup[];
  scanlationMembers?: ScanlationMember[];
  uploaderRequests?: UploaderRequest[];
  mangas?: Omit<Manga, "chapters" | "comments">[];
  chapters?: Omit<Chapter, "uploads">[];
  chapterUploads?: ChapterUpload[];
  mangaComments?: MangaComment[];
  userLibrary?: UserLibraryRecord[];
}

const DB_DIR = path.join(process.cwd(), "data");
const DB_FILE = path.join(DB_DIR, "mangas-db.json");

export function getEmptyDatabase(): DatabaseSchema {
  return {
    mangas: [],
    scanlations: [],
    users: [],
    sessions: [],
    scanlationMembers: [],
    uploaderRequests: [],
    userLibrary: [],
  };
}

function normalizeSchema(
  partial?: Partial<DatabaseSchema> | null
): DatabaseSchema {
  if (!partial) {
    return getEmptyDatabase();
  }

  return {
    mangas: Array.isArray(partial.mangas) ? partial.mangas : [],
    scanlations: Array.isArray(partial.scanlations) ? partial.scanlations : [],
    users: Array.isArray(partial.users) ? partial.users : [],
    sessions: Array.isArray(partial.sessions) ? partial.sessions : [],
    scanlationMembers: Array.isArray(partial.scanlationMembers)
      ? partial.scanlationMembers
      : [],
    uploaderRequests: Array.isArray(partial.uploaderRequests)
      ? partial.uploaderRequests
      : [],
    userLibrary: Array.isArray(partial.userLibrary) ? partial.userLibrary : [],
  };
}

function assembleFromRelational(snap: RelationalSnapshot): DatabaseSchema {
  const rawMangas = Array.isArray(snap.mangas) ? snap.mangas : [];
  const rawChapters = Array.isArray(snap.chapters) ? snap.chapters : [];
  const rawUploads = Array.isArray(snap.chapterUploads)
    ? snap.chapterUploads
    : [];
  const rawComments = Array.isArray(snap.mangaComments)
    ? snap.mangaComments
    : [];

  const uploadsByChapter = new Map<string, ChapterUpload[]>();
  for (const up of rawUploads) {
    const list = uploadsByChapter.get(up.chapterId) ?? [];
    list.push({
      ...up,
      chapterNumber: Number(up.chapterNumber),
      pages: Array.isArray(up.pages) ? up.pages : [],
    });
    uploadsByChapter.set(up.chapterId, list);
  }

  const chaptersByManga = new Map<string, Chapter[]>();
  for (const ch of rawChapters) {
    const list = chaptersByManga.get(ch.mangaId) ?? [];
    list.push({
      ...ch,
      number: Number(ch.number),
      uploads: uploadsByChapter.get(ch.id) ?? [],
    });
    chaptersByManga.set(ch.mangaId, list);
  }

  const commentsByManga = new Map<string, MangaComment[]>();
  for (const cmt of rawComments) {
    const list = commentsByManga.get(cmt.mangaId) ?? [];
    list.push({
      ...cmt,
      chapterNumber:
        cmt.chapterNumber !== null && cmt.chapterNumber !== undefined
          ? Number(cmt.chapterNumber)
          : undefined,
    });
    commentsByManga.set(cmt.mangaId, list);
  }

  const mangas: Manga[] = rawMangas.map((m) => ({
    ...m,
    altTitles: Array.isArray(m.altTitles) ? m.altTitles : [],
    genres: Array.isArray(m.genres) ? m.genres : [],
    rating: Number(m.rating ?? 0),
    votesCount: Number(m.votesCount ?? 0),
    views: Number(m.views ?? 1),
    releaseYear: Number(m.releaseYear ?? 2026),
    chapters: (chaptersByManga.get(m.id) ?? []).sort(
      (a, b) => a.number - b.number
    ),
    comments: commentsByManga.get(m.id) ?? [],
  }));

  return {
    mangas,
    scanlations: Array.isArray(snap.scanlations) ? snap.scanlations : [],
    users: Array.isArray(snap.users) ? snap.users : [],
    sessions: Array.isArray(snap.sessions) ? snap.sessions : [],
    scanlationMembers: Array.isArray(snap.scanlationMembers)
      ? snap.scanlationMembers
      : [],
    uploaderRequests: Array.isArray(snap.uploaderRequests)
      ? snap.uploaderRequests
      : [],
    userLibrary: Array.isArray(snap.userLibrary) ? snap.userLibrary : [],
  };
}

let inflightReadPromise: Promise<DatabaseSchema> | null = null;

async function performReadDatabase(): Promise<DatabaseSchema> {
  if (isNeonConfigured()) {
    try {
      await ensureNeonStoreTable();
      const neonRes = await executeNeonQuery<{ data: RelationalSnapshot }>(`
        SELECT json_build_object(
          'users', COALESCE((SELECT json_agg(row_to_json(u)) FROM (
            SELECT id, username, email, password_hash AS "passwordHash", role, bio, created_at AS "createdAt"
            FROM users ORDER BY created_at ASC
          ) u), '[]'::json),
          'sessions', COALESCE((SELECT json_agg(row_to_json(s)) FROM (
            SELECT token, user_id AS "userId", expires_at AS "expiresAt"
            FROM sessions WHERE expires_at > NOW()
          ) s), '[]'::json),
          'scanlations', COALESCE((SELECT json_agg(row_to_json(sc)) FROM (
            SELECT id, name, slug, owner_id AS "ownerId", verified, website, discord, description,
                   members_count AS "membersCount", uploads_count AS "uploadsCount", updated_at AS "updatedAt"
            FROM scanlations ORDER BY name ASC
          ) sc), '[]'::json),
          'scanlationMembers', COALESCE((SELECT json_agg(row_to_json(sm)) FROM (
            SELECT id, scanlation_id AS "scanlationId", scanlation_name AS "scanlationName",
                   user_id AS "userId", username, email, role, added_at AS "addedAt"
            FROM scanlation_members ORDER BY added_at ASC
          ) sm), '[]'::json),
          'uploaderRequests', COALESCE((SELECT json_agg(row_to_json(ur)) FROM (
            SELECT id, user_id AS "userId", username, user_email AS "userEmail", type, reason,
                   proposed_scan_name AS "proposedScanName",
                   proposed_scan_description AS "proposedScanDescription",
                   proposed_scan_discord AS "proposedScanDiscord",
                   status, created_at AS "createdAt", reviewed_by AS "reviewedBy", reviewed_at AS "reviewedAt"
            FROM uploader_requests ORDER BY created_at DESC
          ) ur), '[]'::json),
          'mangas', COALESCE((SELECT json_agg(row_to_json(m)) FROM (
            SELECT id, slug, title, alt_titles AS "altTitles", synopsis, cover_url AS "coverUrl",
                   banner_url AS "bannerUrl", type, demography, status, author, artist,
                   release_year AS "releaseYear", genres, rating, votes_count AS "votesCount",
                   views, created_by_id AS "createdById", created_by_username AS "createdByUsername",
                   created_at AS "createdAt", updated_at AS "updatedAt"
            FROM mangas ORDER BY created_at DESC
          ) m), '[]'::json),
          'chapters', COALESCE((SELECT json_agg(row_to_json(ch)) FROM (
            SELECT id, manga_id AS "mangaId", number, title, created_at AS "createdAt"
            FROM chapters ORDER BY number ASC
          ) ch), '[]'::json),
          'chapterUploads', COALESCE((SELECT json_agg(row_to_json(cu)) FROM (
            SELECT id, chapter_id AS "chapterId", manga_id AS "mangaId", manga_slug AS "mangaSlug",
                   manga_title AS "mangaTitle", manga_cover AS "mangaCover", manga_type AS "mangaType",
                   manga_demography AS "mangaDemography", chapter_number AS "chapterNumber",
                   chapter_title AS "chapterTitle", COALESCE(scanlation_id, '') AS "scanlationId",
                   COALESCE(scanlation_name, '') AS "scanlationName", uploader_id AS "uploaderId",
                   uploader_username AS "uploaderUsername", language, pages, views, created_at AS "createdAt", updated_at AS "updatedAt"
            FROM chapter_uploads ORDER BY created_at DESC
          ) cu), '[]'::json),
          'mangaComments', COALESCE((SELECT json_agg(row_to_json(mc)) FROM (
            SELECT id, manga_id AS "mangaId", chapter_number AS "chapterNumber", user_id AS "userId",
                   author_name AS "authorName", author_role AS "authorRole", content, likes,
                   spoiler, created_at AS "createdAt"
            FROM manga_comments ORDER BY created_at DESC
          ) mc), '[]'::json),
          'userLibrary', COALESCE((SELECT json_agg(row_to_json(ul)) FROM (
            SELECT id, user_id AS "userId", manga_id AS "mangaId", status,
                   last_read_chapter AS "lastReadChapter", last_read_upload_id AS "lastReadUploadId",
                   updated_at AS "updatedAt"
            FROM user_library ORDER BY updated_at DESC
          ) ul), '[]'::json)
        ) AS data;
      `);

      if (neonRes.ok && neonRes.rows.length > 0 && neonRes.rows[0].data) {
        return assembleFromRelational(neonRes.rows[0].data);
      }
    } catch {
      // Fallback a espejo local si no hay conexión saliente
    }
  }

  if (isTestEnvironment() || isProductionRuntime()) {
    throw new Error("No se pudo leer PostgreSQL; se bloquea el fallback JSON en este entorno.");
  }

  try {
    const raw = await fs.readFile(DB_FILE, "utf-8");
    const parsed = JSON.parse(raw) as Partial<DatabaseSchema>;
    return normalizeSchema(parsed);
  } catch {
    return getEmptyDatabase();
  }
}

let cachedDatabase: DatabaseSchema | null = null;
let cachedDatabaseTimestamp = 0;
const DB_CACHE_TTL_MS = 25_000; // 25 segundos de caché en memoria ultra-rápida

export function invalidateDatabaseCache(): void {
  cachedDatabase = null;
  cachedDatabaseTimestamp = 0;
  inflightReadPromise = null;
}

export async function readDatabase(forceFresh = false): Promise<DatabaseSchema> {
  // Staging pages must read the isolated DB at request time, never freeze an
  // empty catalogue into the build or require remote secrets during build.
  if (isTestEnvironment()) await connection();
  const now = Date.now();
  if (!forceFresh && cachedDatabase && now - cachedDatabaseTimestamp < DB_CACHE_TTL_MS) {
    return cachedDatabase;
  }

  if (inflightReadPromise) {
    return inflightReadPromise;
  }

  inflightReadPromise = performReadDatabase()
    .then((data) => {
      cachedDatabase = data;
      cachedDatabaseTimestamp = Date.now();
      inflightReadPromise = null;
      return data;
    })
    .catch((err) => {
      inflightReadPromise = null;
      if (cachedDatabase) {
        return cachedDatabase;
      }
      throw err;
    });

  return inflightReadPromise;
}

export async function writeDatabase(db: DatabaseSchema): Promise<void> {
  if (isProductionRuntime() && !isNeonConfigured()) {
    throw new Error("No se puede guardar sin configurar DATABASE_URL.");
  }
  cachedDatabase = db;
  cachedDatabaseTimestamp = Date.now();
  inflightReadPromise = null;

  try {
    if (!isLocalTest() && !isProductionRuntime()) {
      await fs.mkdir(DB_DIR, { recursive: true });
      await fs.writeFile(DB_FILE, JSON.stringify(db, null, 2), "utf-8");
    }
  } catch {
    // Ignorar errores de disco local en entornos serverless (Cloudflare Workers)
  }

  if (isNeonConfigured()) {
    try {
      await ensureNeonStoreTable();

      const flatMangas: Omit<Manga, "chapters" | "comments">[] = [];
      const flatChapters: Omit<Chapter, "uploads">[] = [];
      const flatUploads: ChapterUpload[] = [];
      const flatComments: MangaComment[] = [];

      for (const m of db.mangas) {
        const { chapters, comments, ...mangaRest } = m;
        flatMangas.push(mangaRest);

        for (const ch of chapters ?? []) {
          const { uploads, ...chRest } = ch;
          flatChapters.push(chRest);
          for (const up of uploads ?? []) {
            flatUploads.push(up);
          }
        }

        for (const cmt of comments ?? []) {
          flatComments.push(cmt);
        }
      }

      const relationalPayload: RelationalSnapshot = {
        users: db.users,
        sessions: db.sessions,
        scanlations: db.scanlations,
        scanlationMembers: db.scanlationMembers,
        uploaderRequests: db.uploaderRequests,
        mangas: flatMangas,
        chapters: flatChapters,
        chapterUploads: flatUploads,
        mangaComments: flatComments,
        userLibrary: db.userLibrary,
      };

      const syncRes = await executeNeonQuery(
        "SELECT sync_kuramanga_relational($1::jsonb);",
        [JSON.stringify(relationalPayload)]
      );

      if (!syncRes.ok) {
        console.error("Error al sincronizar Neon:", syncRes.error);
        throw new Error(syncRes.error || "Error al guardar en base de datos Neon");
      }
    } catch (err) {
      console.error("Error en writeDatabase Neon:", err);
      throw err;
    }
  }
}

export async function getAllMangas(): Promise<Manga[]> {
  const db = await readDatabase();
  return db.mangas;
}

export async function getMangaBySlug(slug: string): Promise<Manga | undefined> {
  // A 301 must never send visitors to a stale snapshot of the old slug.
  const db = await readDatabase(true);
  return db.mangas.find((m) => m.slug === slug);
}

export async function getLatestUploads(limit = 12): Promise<ChapterUpload[]> {
  const db = await readDatabase();
  const allUploads: ChapterUpload[] = [];

  for (const manga of db.mangas) {
    for (const chapter of manga.chapters) {
      for (const upload of chapter.uploads) {
        allUploads.push(upload);
      }
    }
  }

  return allUploads
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
    .slice(0, limit);
}

export async function getUploadById(uploadId: string): Promise<{
  upload: ChapterUpload;
  manga: Manga;
  prevUploadId: string | null;
  nextUploadId: string | null;
  allChapterUploads: {
    chapterNumber: number;
    chapterTitle: string;
    uploadId: string;
  }[];
} | null> {
  const db = await readDatabase();

  for (const manga of db.mangas) {
    const sortedChapters = [...manga.chapters].sort(
      (a, b) => a.number - b.number
    );

    const flatList = sortedChapters
      .filter((c) => c.uploads.length > 0)
      .map((c) => ({
        chapterNumber: c.number,
        chapterTitle: c.title,
        uploadId: c.uploads[0].id,
      }));

    for (let cIdx = 0; cIdx < sortedChapters.length; cIdx++) {
      const ch = sortedChapters[cIdx];
      const foundUpload = ch.uploads.find((u) => u.id === uploadId);
      if (foundUpload) {
        const prevChapter = cIdx > 0 ? sortedChapters[cIdx - 1] : null;
        const nextChapter =
          cIdx < sortedChapters.length - 1 ? sortedChapters[cIdx + 1] : null;

        return {
          upload: foundUpload,
          manga,
          prevUploadId: prevChapter?.uploads[0]?.id ?? null,
          nextUploadId: nextChapter?.uploads[0]?.id ?? null,
          allChapterUploads: flatList,
        };
      }
    }
  }

  return null;
}

export async function getScanlationGroups(): Promise<ScanlationGroup[]> {
  const db = await readDatabase();
  return db.scanlations;
}

export async function getScanlationBySlug(slug: string): Promise<{
  group: ScanlationGroup;
  uploads: ChapterUpload[];
  mangas: Manga[];
  members: ScanlationMember[];
} | null> {
  const db = await readDatabase();
  const group = db.scanlations.find((s) => s.slug === slug);
  if (!group) return null;

  const uploads: ChapterUpload[] = [];
  const mangaMap = new Map<string, Manga>();

  for (const manga of db.mangas) {
    for (const ch of manga.chapters) {
      for (const up of ch.uploads) {
        if (up.scanlationId === group.id || up.scanlationName === group.name) {
          uploads.push(up);
          mangaMap.set(manga.id, manga);
        }
      }
    }
  }

  uploads.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const members = (db.scanlationMembers ?? []).filter(
    (m) => m.scanlationId === group.id
  );

  return {
    group,
    uploads,
    mangas: Array.from(mangaMap.values()),
    members,
  };
}

export interface LibraryFilterParams {
  q?: string;
  type?: WorkType | "ALL";
  demography?: Demography | "ALL";
  status?: WorkStatus | "ALL";
  genre?: string | "ALL";
  sort?: "rating" | "views" | "latest" | "az";
}

export async function filterMangas(
  params: LibraryFilterParams
): Promise<Manga[]> {
  const db = await readDatabase();
  let list = [...db.mangas];

  if (params.q && params.q.trim() !== "") {
    const q = params.q.trim().toLowerCase();
    list = list.filter(
      (m) =>
        m.title.toLowerCase().includes(q) ||
        m.author.toLowerCase().includes(q) ||
        m.altTitles.some((alt) => alt.toLowerCase().includes(q))
    );
  }

  if (params.type && params.type !== "ALL") {
    list = list.filter((m) => m.type === params.type);
  }

  if (params.demography && params.demography !== "ALL") {
    list = list.filter((m) => m.demography === params.demography);
  }

  if (params.status && params.status !== "ALL") {
    list = list.filter((m) => m.status === params.status);
  }

  if (params.genre && params.genre !== "ALL") {
    list = list.filter((m) =>
      m.genres.some((g) => g.toLowerCase() === params.genre!.toLowerCase())
    );
  }

  const sort = params.sort ?? "views";
  if (sort === "rating") {
    list.sort((a, b) => b.rating - a.rating);
  } else if (sort === "latest") {
    list.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  } else if (sort === "az") {
    list.sort((a, b) => a.title.localeCompare(b.title));
  } else {
    list.sort((a, b) => b.views - a.views);
  }

  return list;
}

export async function recordMangaView(
  mangaId: string,
  uploadId?: string
): Promise<{ success: boolean; mangaViews?: number; uploadViews?: number }> {
  try {
    let neonResult: { mangaViews?: number; uploadViews?: number } = {};
    if (isNeonConfigured()) {
      neonResult = await atomicIncrementViews(mangaId, uploadId);
    }

    // Actualizar directamente en la caché en memoria para respuesta instantánea
    if (cachedDatabase) {
      const cachedManga = cachedDatabase.mangas.find((m) => m.id === mangaId);
      if (cachedManga) {
        cachedManga.views = neonResult.mangaViews ?? (cachedManga.views || 0) + 1;
        if (uploadId) {
          for (const ch of cachedManga.chapters) {
            const up = ch.uploads.find((u) => u.id === uploadId);
            if (up) {
              up.views = neonResult.uploadViews ?? (up.views || 0) + 1;
              break;
            }
          }
        }
      }
    }

    try {
      const raw = await fs.readFile(DB_FILE, "utf-8");
      const db = normalizeSchema(JSON.parse(raw));
      let modified = false;

      const manga = db.mangas.find((m) => m.id === mangaId);
      if (manga) {
        manga.views = neonResult.mangaViews ?? (manga.views || 0) + 1;
        modified = true;

        if (uploadId) {
          for (const ch of manga.chapters) {
            const up = ch.uploads.find((u) => u.id === uploadId);
            if (up) {
              up.views = neonResult.uploadViews ?? (up.views || 0) + 1;
              break;
            }
          }
        }
      }

      if (modified) {
        await fs.writeFile(DB_FILE, JSON.stringify(db, null, 2), "utf-8");
      }
    } catch {
      // Ignorar fallback de archivo si estamos en un entorno solo de lectura
    }

    return {
      success: true,
      mangaViews: neonResult.mangaViews,
      uploadViews: neonResult.uploadViews,
    };
  } catch (err) {
    console.error("Error en recordMangaView:", err);
    return { success: false };
  }
}

export interface SiteAnalytics {
  totalViews: number;
  totalMangas: number;
  totalChapters: number;
  totalUploads: number;
  totalUsers: number;
  topMangas: Array<{
    id: string;
    title: string;
    slug: string;
    coverUrl: string;
    views: number;
    rating: number;
    type: string;
    demography: string;
    chaptersCount: number;
  }>;
  topChapters: Array<{
    id: string;
    mangaTitle: string;
    mangaSlug: string;
    chapterNumber: number;
    chapterTitle: string;
    scanlationName: string;
    views: number;
  }>;
  viewsByType: Record<string, number>;
  viewsByDemography: Record<string, number>;
  scanlationsRank: Array<{
    id: string;
    name: string;
    slug: string;
    verified: boolean;
    totalViews: number;
    uploadsCount: number;
  }>;
}

export async function getSiteAnalytics(): Promise<SiteAnalytics> {
  const db = await readDatabase();

  let totalViews = 0;
  let totalChapters = 0;
  let totalUploads = 0;

  const viewsByType: Record<string, number> = {};
  const viewsByDemography: Record<string, number> = {};
  const allChapterUploads: Array<{
    id: string;
    mangaTitle: string;
    mangaSlug: string;
    chapterNumber: number;
    chapterTitle: string;
    scanlationName: string;
    views: number;
  }> = [];

  const scanlationMap = new Map<
    string,
    {
      id: string;
      name: string;
      slug: string;
      verified: boolean;
      totalViews: number;
      uploadsCount: number;
    }
  >();

  for (const s of db.scanlations) {
    scanlationMap.set(s.id, {
      id: s.id,
      name: s.name,
      slug: s.slug,
      verified: Boolean(s.verified),
      totalViews: 0,
      uploadsCount: 0,
    });
  }

  const topMangas = db.mangas.map((m) => {
    const mangaViews = m.views || 0;
    totalViews += mangaViews;
    totalChapters += m.chapters?.length || 0;

    viewsByType[m.type] = (viewsByType[m.type] || 0) + mangaViews;
    viewsByDemography[m.demography] =
      (viewsByDemography[m.demography] || 0) + mangaViews;

    for (const ch of m.chapters ?? []) {
      for (const up of ch.uploads ?? []) {
        totalUploads += 1;
        const uploadViews = up.views || 0;

        allChapterUploads.push({
          id: up.id,
          mangaTitle: m.title,
          mangaSlug: m.slug,
          chapterNumber: ch.number,
          chapterTitle: ch.title,
          scanlationName: up.scanlationName,
          views: uploadViews,
        });

        const sKey = up.scanlationId || up.scanlationName;
        if (!sKey) continue;
        let sEntry = scanlationMap.get(sKey);
        if (!sEntry) {
          sEntry = {
            id: up.scanlationId || `scan-${up.scanlationName.toLowerCase().replace(/\s+/g, "-")}`,
            name: up.scanlationName,
            slug: up.scanlationName.toLowerCase().replace(/\s+/g, "-"),
            verified: false,
            totalViews: 0,
            uploadsCount: 0,
          };
          scanlationMap.set(sKey, sEntry);
        }
        sEntry.uploadsCount += 1;
        sEntry.totalViews += uploadViews;
      }
    }

    return {
      id: m.id,
      title: m.title,
      slug: m.slug,
      coverUrl: m.coverUrl,
      views: mangaViews,
      rating: m.rating,
      type: m.type,
      demography: m.demography,
      chaptersCount: m.chapters?.length || 0,
    };
  });

  topMangas.sort((a, b) => b.views - a.views);
  allChapterUploads.sort((a, b) => b.views - a.views);

  const scanlationsRank = Array.from(scanlationMap.values()).sort(
    (a, b) => b.totalViews - a.totalViews || b.uploadsCount - a.uploadsCount
  );

  return {
    totalViews,
    totalMangas: db.mangas.length,
    totalChapters,
    totalUploads,
    totalUsers: db.users.length,
    topMangas: topMangas.slice(0, 10),
    topChapters: allChapterUploads.slice(0, 10),
    viewsByType,
    viewsByDemography,
    scanlationsRank: scanlationsRank.slice(0, 10),
  };
}

