import fs from "node:fs/promises";
import path from "node:path";
import {
  ensureNeonStoreTable,
  executeNeonQuery,
  isNeonConfigured,
} from "./neon-db";
import {
  ChapterUpload,
  Demography,
  Manga,
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

function normalizeSchema(partial?: Partial<DatabaseSchema> | null): DatabaseSchema {
  // Si el payload antiguo contenía datos de demostración ("user-admin" / "manga-1"), limpiar a producción
  const hasLegacyDemoData =
    partial?.users?.some((u) => u.id === "user-admin" && u.email === "admin@kuramanga.com") ||
    partial?.mangas?.some((m) => m.id === "manga-1" && m.slug === "cronicas-del-monarca-de-las-sombras");

  if (!partial || hasLegacyDemoData) {
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

let inflightReadPromise: Promise<DatabaseSchema> | null = null;

async function performReadDatabase(): Promise<DatabaseSchema> {
  if (isNeonConfigured()) {
    try {
      const neonRes = await executeNeonQuery<{ payload: DatabaseSchema }>(
        "SELECT payload FROM kuramanga_store WHERE id = 'main' LIMIT 1;"
      );
      if (neonRes.ok && neonRes.rows.length > 0 && neonRes.rows[0].payload) {
        const rawPayload = neonRes.rows[0].payload;
        const normalized = normalizeSchema(rawPayload);
        // Si tenía datos demo antiguos, guardar la base limpia en Neon
        if (
          rawPayload.users?.some(
            (u) => u.id === "user-admin" && u.email === "admin@kuramanga.com"
          )
        ) {
          await writeDatabase(normalized);
        }
        return normalized;
      }
    } catch {
      // Fallback a espejo local si no hay conexión saliente
    }
  }

  try {
    const raw = await fs.readFile(DB_FILE, "utf-8");
    const parsed = JSON.parse(raw) as Partial<DatabaseSchema>;
    return normalizeSchema(parsed);
  } catch {
    return getEmptyDatabase();
  }
}

export async function readDatabase(): Promise<DatabaseSchema> {
  if (inflightReadPromise) {
    return inflightReadPromise;
  }

  inflightReadPromise = performReadDatabase()
    .then((data) => {
      inflightReadPromise = null;
      return data;
    })
    .catch((err) => {
      inflightReadPromise = null;
      throw err;
    });

  return inflightReadPromise;
}

export async function writeDatabase(db: DatabaseSchema): Promise<void> {
  try {
    await fs.mkdir(DB_DIR, { recursive: true });
    await fs.writeFile(DB_FILE, JSON.stringify(db, null, 2), "utf-8");
  } catch {
    // Ignorar errores de disco local en entornos serverless (Cloudflare Workers)
  }

  if (isNeonConfigured()) {
    try {
      await ensureNeonStoreTable();
      await executeNeonQuery(
        `INSERT INTO kuramanga_store (id, payload, updated_at)
         VALUES ('main', $1::jsonb, NOW())
         ON CONFLICT (id) DO UPDATE
         SET payload = EXCLUDED.payload, updated_at = NOW();`,
        [JSON.stringify(db)]
      );
    } catch {
      // Ignorar errores de red en modo offline
    }
  }
}

export async function getAllMangas(): Promise<Manga[]> {
  const db = await readDatabase();
  return db.mangas;
}

export async function getMangaBySlug(slug: string): Promise<Manga | undefined> {
  const db = await readDatabase();
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
