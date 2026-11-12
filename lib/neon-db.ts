import dns from "node:dns";
import { Socket } from "node:net";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { Client } from "pg";
import { getR2Config, isR2Configured } from "./r2-storage";
import { isLocalTest, isStaging, isTestEnvironment, runtimeVariable, validateStagingDatabase } from "./runtime-environment";
import { validateLocalDatabaseUrl } from "./local-test-config";
import { requireDatabaseUrl } from "./database-config";

try {
  dns.setDefaultResultOrder?.("ipv4first");
} catch {
  // En entornos Edge/Cloudflare Workers donde node:dns es un stub, ignorar
}

function getHyperdriveConnectionString(): string | null {
  if (isTestEnvironment()) return null;
  try {
    const ctx = getCloudflareContext();
    const env = ctx?.env as
      | Record<string, { connectionString?: string }>
      | undefined;
    const hd = env?.["bd-manga"];
    if (
      hd &&
      typeof hd.connectionString === "string" &&
      hd.connectionString.length > 0
    ) {
      return hd.connectionString;
    }
  } catch {
    // Fuera de contexto de request de Cloudflare Workers
  }
  return null;
}

export function getDatabaseUrl(): string {
  if (isLocalTest()) return validateLocalDatabaseUrl(runtimeVariable("DATABASE_URL"));
  if (isStaging()) {
    return validateStagingDatabase(runtimeVariable("DATABASE_URL"));
  }
  return requireDatabaseUrl(runtimeVariable("DATABASE_URL"));
}

export function isNeonConfigured(): boolean {
  if (!runtimeVariable("DATABASE_URL")) return false;
  const url = getDatabaseUrl();
  return (
    (url.startsWith("postgres://") || url.startsWith("postgresql://")) &&
    !url.includes("tu_password")
  );
}

/**
 * Ejecuta una consulta SQL parametrizada contra Neon PostgreSQL:
 * 1) Primero utiliza el endpoint HTTP Serverless nativo de Neon (https://<host>/sql),
 *    que no requiere abrir sockets TCP y responde en milisegundos desde Cloudflare Workers.
 * 2) Si el endpoint HTTP no está disponible y existe Hyperdrive ("bd-manga"), usa pg Client.
 */
export async function executeNeonQuery<T = Record<string, unknown>>(
  query: string,
  params: unknown[] = []
): Promise<{
  rows: T[];
  ok: boolean;
  driver?: "neon-http" | "hyperdrive-pg" | "local-pg";
  error?: string;
}> {
  if (process.env.NEXT_PHASE === "phase-production-build") {
    return { rows: [], ok: false, error: "Build phase skip" };
  }

  if (isLocalTest()) {
    // This branch never calls Neon HTTP, Hyperdrive or an external host.
    const client = new Client({
      connectionString: getDatabaseUrl(), ssl: false,
      // Use the supported Node TCP socket in both Next dev and workerd.
      // Bundling pg in Next can otherwise resolve pg-cloudflare's Node stub.
      stream: () => new Socket(),
      connectionTimeoutMillis: 5000, query_timeout: 15000,
    });
    try {
      await client.connect();
      const result = await client.query(query, params);
      return { rows: (result.rows ?? []) as T[], ok: true, driver: "local-pg" };
    } catch (error) {
      return { rows: [], ok: false, driver: "local-pg", error: error instanceof Error ? error.message : "Error PostgreSQL local" };
    } finally {
      await client.end().catch(() => {});
    }
  }

  if (!isNeonConfigured()) {
    return {
      rows: [],
      ok: false,
      error: "DATABASE_URL de Neon aún no está configurada",
    };
  }

  let httpErrorDetail = "";

  // 1. Endpoint HTTP Serverless de Neon (https://<host>/sql)
  try {
    const cleanConnectionString = getDatabaseUrl();
    const dbUrl = new URL(cleanConnectionString);
    const host = dbUrl.hostname;
    const endpoint = `https://${host}/sql`;

    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Neon-Connection-String": cleanConnectionString,
      },
      body: JSON.stringify({ query, params }),
    });

    if (res.ok) {
      const data = (await res.json()) as {
        rows?: T[];
        message?: string;
        severity?: string;
      };

      if (data.severity === "ERROR" || (data.message && !data.rows)) {
        return {
          rows: [],
          ok: false,
          error: data.message || "Error en consulta SQL de Neon",
        };
      }

      return { rows: data.rows ?? [], ok: true, driver: "neon-http" };
    } else {
      const text = await res.text().catch(() => "");
      httpErrorDetail = `HTTP ${res.status}: ${text.slice(0, 180)}`;
    }
  } catch (err) {
    httpErrorDetail = err instanceof Error ? err.message : "Error HTTP Neon";
  }

  // 2. Fallback a Cloudflare Hyperdrive si el binding "bd-manga" está presente
  const hyperdriveConn = getHyperdriveConnectionString();
  if (hyperdriveConn) {
    const client = new Client({ connectionString: hyperdriveConn });
    try {
      await client.connect();
      const result = await client.query(query, params);
      await client.end();
      return {
        rows: (result.rows as T[]) ?? [],
        ok: true,
        driver: "hyperdrive-pg",
      };
    } catch (err) {
      try {
        await client.end();
      } catch {
        // ignore
      }
      return {
        rows: [],
        ok: false,
        error: `Neon HTTP (${httpErrorDetail}) | Hyperdrive (${err instanceof Error ? err.message : "Error"
          })`,
      };
    }
  }

  return {
    rows: [],
    ok: false,
    error: httpErrorDetail || "No se pudo conectar a Neon HTTP ni Hyperdrive",
  };
}

let relationalSchemaInitialized = false;

/**
 * Elimina la antigua tabla monolítica `kuramanga_store` y crea las 10 tablas
 * relacionales reales de KuraManga en Neon PostgreSQL.
 */
export async function ensureNeonStoreTable(): Promise<boolean> {
  if (relationalSchemaInitialized) return true;

  const res = await executeNeonQuery(`
    DO $$
    BEGIN
      -- Eliminar la tabla antigua monolítica para comenzar limpio con tablas relacionales
      ${isLocalTest() ? "-- Local tests never drop the legacy store." : "DROP TABLE IF EXISTS kuramanga_store;"}

      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL,
        email TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'READER',
        bio TEXT NOT NULL DEFAULT '',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS sessions (
        token TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL
      );

      CREATE TABLE IF NOT EXISTS scanlations (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        slug TEXT NOT NULL,
        owner_id TEXT,
        verified BOOLEAN NOT NULL DEFAULT FALSE,
        website TEXT,
        discord TEXT,
        description TEXT NOT NULL DEFAULT '',
        members_count INTEGER NOT NULL DEFAULT 1,
        uploads_count INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS scanlation_members (
        id TEXT PRIMARY KEY,
        scanlation_id TEXT NOT NULL,
        scanlation_name TEXT NOT NULL,
        user_id TEXT NOT NULL,
        username TEXT NOT NULL,
        email TEXT NOT NULL,
        role TEXT NOT NULL,
        added_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS uploader_requests (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        username TEXT NOT NULL,
        user_email TEXT NOT NULL,
        type TEXT NOT NULL,
        reason TEXT NOT NULL,
        proposed_scan_name TEXT,
        proposed_scan_description TEXT,
        proposed_scan_discord TEXT,
        status TEXT NOT NULL DEFAULT 'PENDING',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        reviewed_by TEXT,
        reviewed_at TIMESTAMPTZ
      );

      CREATE TABLE IF NOT EXISTS mangas (
        id TEXT PRIMARY KEY,
        slug TEXT NOT NULL,
        title TEXT NOT NULL,
        alt_titles JSONB NOT NULL DEFAULT '[]'::jsonb,
        synopsis TEXT NOT NULL,
        cover_url TEXT NOT NULL,
        banner_url TEXT,
        type TEXT NOT NULL,
        demography TEXT NOT NULL,
        status TEXT NOT NULL,
        author TEXT NOT NULL,
        artist TEXT NOT NULL,
        release_year INTEGER NOT NULL DEFAULT 2026,
        genres JSONB NOT NULL DEFAULT '[]'::jsonb,
        rating DOUBLE PRECISION NOT NULL DEFAULT 5.0,
        votes_count INTEGER NOT NULL DEFAULT 1,
        views INTEGER NOT NULL DEFAULT 1,
        created_by_id TEXT,
        created_by_username TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS chapters (
        id TEXT PRIMARY KEY,
        manga_id TEXT NOT NULL,
        number DOUBLE PRECISION NOT NULL,
        title TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS chapter_uploads (
        id TEXT PRIMARY KEY,
        chapter_id TEXT NOT NULL,
        manga_id TEXT NOT NULL,
        manga_slug TEXT NOT NULL,
        manga_title TEXT NOT NULL,
        manga_cover TEXT NOT NULL,
        manga_type TEXT NOT NULL,
        manga_demography TEXT NOT NULL,
        chapter_number DOUBLE PRECISION NOT NULL,
        chapter_title TEXT NOT NULL,
        scanlation_id TEXT NOT NULL,
        scanlation_name TEXT NOT NULL,
        uploader_id TEXT,
        uploader_username TEXT,
        language TEXT NOT NULL DEFAULT 'ES',
        pages JSONB NOT NULL DEFAULT '[]'::jsonb,
        views INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS manga_comments (
        id TEXT PRIMARY KEY,
        manga_id TEXT NOT NULL,
        chapter_number DOUBLE PRECISION,
        user_id TEXT,
        author_name TEXT NOT NULL,
        author_role TEXT,
        content TEXT NOT NULL,
        likes INTEGER NOT NULL DEFAULT 1,
        spoiler BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS user_library (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        manga_id TEXT NOT NULL,
        status TEXT NOT NULL,
        last_read_chapter DOUBLE PRECISION,
        last_read_upload_id TEXT,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_mangas_views ON mangas (views DESC);
      CREATE INDEX IF NOT EXISTS idx_chapter_uploads_views ON chapter_uploads (views DESC);

      CREATE OR REPLACE FUNCTION sync_kuramanga_relational(p JSONB)
      RETURNS VOID
      LANGUAGE plpgsql
      AS $func$
      BEGIN
        DELETE FROM users WHERE id NOT IN (
          SELECT value->>'id' FROM jsonb_array_elements(COALESCE(p->'users', '[]'::jsonb))
        );
        INSERT INTO users (id, username, email, password_hash, role, bio, created_at)
        SELECT
          value->>'id',
          value->>'username',
          value->>'email',
          value->>'passwordHash',
          COALESCE(value->>'role', 'READER'),
          COALESCE(value->>'bio', ''),
          COALESCE((value->>'createdAt')::timestamptz, NOW())
        FROM jsonb_array_elements(COALESCE(p->'users', '[]'::jsonb))
        ON CONFLICT (id) DO UPDATE SET
          username = EXCLUDED.username,
          email = EXCLUDED.email,
          password_hash = EXCLUDED.password_hash,
          role = EXCLUDED.role,
          bio = EXCLUDED.bio;

        DELETE FROM sessions WHERE expires_at <= NOW() OR token NOT IN (
          SELECT value->>'token' FROM jsonb_array_elements(COALESCE(p->'sessions', '[]'::jsonb))
        );
        INSERT INTO sessions (token, user_id, expires_at)
        SELECT
          value->>'token',
          value->>'userId',
          (value->>'expiresAt')::timestamptz
        FROM jsonb_array_elements(COALESCE(p->'sessions', '[]'::jsonb))
        ON CONFLICT (token) DO UPDATE SET
          user_id = EXCLUDED.user_id,
          expires_at = EXCLUDED.expires_at;

        DELETE FROM scanlations WHERE id NOT IN (
          SELECT value->>'id' FROM jsonb_array_elements(COALESCE(p->'scanlations', '[]'::jsonb))
        );
        INSERT INTO scanlations (id, name, slug, owner_id, verified, website, discord, description, members_count, uploads_count)
        SELECT
          value->>'id',
          value->>'name',
          value->>'slug',
          value->>'ownerId',
          COALESCE((value->>'verified')::boolean, false),
          value->>'website',
          value->>'discord',
          COALESCE(value->>'description', ''),
          COALESCE((value->>'membersCount')::int, 1),
          COALESCE((value->>'uploadsCount')::int, 0)
        FROM jsonb_array_elements(COALESCE(p->'scanlations', '[]'::jsonb))
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          slug = EXCLUDED.slug,
          owner_id = EXCLUDED.owner_id,
          verified = EXCLUDED.verified,
          website = EXCLUDED.website,
          discord = EXCLUDED.discord,
          description = EXCLUDED.description,
          members_count = EXCLUDED.members_count,
          uploads_count = EXCLUDED.uploads_count;

        DELETE FROM scanlation_members WHERE id NOT IN (
          SELECT value->>'id' FROM jsonb_array_elements(COALESCE(p->'scanlationMembers', '[]'::jsonb))
        );
        INSERT INTO scanlation_members (id, scanlation_id, scanlation_name, user_id, username, email, role, added_at)
        SELECT
          value->>'id',
          value->>'scanlationId',
          value->>'scanlationName',
          value->>'userId',
          value->>'username',
          value->>'email',
          value->>'role',
          COALESCE((value->>'addedAt')::timestamptz, NOW())
        FROM jsonb_array_elements(COALESCE(p->'scanlationMembers', '[]'::jsonb))
        ON CONFLICT (id) DO UPDATE SET
          scanlation_name = EXCLUDED.scanlation_name,
          username = EXCLUDED.username,
          email = EXCLUDED.email,
          role = EXCLUDED.role;

        DELETE FROM uploader_requests WHERE id NOT IN (
          SELECT value->>'id' FROM jsonb_array_elements(COALESCE(p->'uploaderRequests', '[]'::jsonb))
        );
        INSERT INTO uploader_requests (id, user_id, username, user_email, type, reason, proposed_scan_name, proposed_scan_description, proposed_scan_discord, status, created_at, reviewed_by, reviewed_at)
        SELECT
          value->>'id',
          value->>'userId',
          value->>'username',
          value->>'userEmail',
          value->>'type',
          value->>'reason',
          value->>'proposedScanName',
          value->>'proposedScanDescription',
          value->>'proposedScanDiscord',
          COALESCE(value->>'status', 'PENDING'),
          COALESCE((value->>'createdAt')::timestamptz, NOW()),
          value->>'reviewedBy',
          CASE WHEN value->>'reviewedAt' IS NOT NULL THEN (value->>'reviewedAt')::timestamptz ELSE NULL END
        FROM jsonb_array_elements(COALESCE(p->'uploaderRequests', '[]'::jsonb))
        ON CONFLICT (id) DO UPDATE SET
          status = EXCLUDED.status,
          reviewed_by = EXCLUDED.reviewed_by,
          reviewed_at = EXCLUDED.reviewed_at;

        DELETE FROM mangas WHERE id NOT IN (
          SELECT value->>'id' FROM jsonb_array_elements(COALESCE(p->'mangas', '[]'::jsonb))
        );
        INSERT INTO mangas (id, slug, title, alt_titles, synopsis, cover_url, banner_url, type, demography, status, author, artist, release_year, genres, rating, votes_count, views, created_by_id, created_by_username, created_at)
        SELECT
          value->>'id',
          value->>'slug',
          value->>'title',
          COALESCE(value->'altTitles', '[]'::jsonb),
          value->>'synopsis',
          value->>'coverUrl',
          value->>'bannerUrl',
          value->>'type',
          value->>'demography',
          value->>'status',
          value->>'author',
          value->>'artist',
          COALESCE((value->>'releaseYear')::int, 2026),
          COALESCE(value->'genres', '[]'::jsonb),
          COALESCE((value->>'rating')::double precision, 5.0),
          COALESCE((value->>'votesCount')::int, 1),
          COALESCE((value->>'views')::int, 1),
          value->>'createdById',
          value->>'createdByUsername',
          COALESCE((value->>'createdAt')::timestamptz, NOW())
        FROM jsonb_array_elements(COALESCE(p->'mangas', '[]'::jsonb))
        ON CONFLICT (id) DO UPDATE SET
          slug = EXCLUDED.slug,
          title = EXCLUDED.title,
          alt_titles = EXCLUDED.alt_titles,
          synopsis = EXCLUDED.synopsis,
          cover_url = EXCLUDED.cover_url,
          banner_url = EXCLUDED.banner_url,
          type = EXCLUDED.type,
          demography = EXCLUDED.demography,
          status = EXCLUDED.status,
          author = EXCLUDED.author,
          artist = EXCLUDED.artist,
          release_year = EXCLUDED.release_year,
          genres = EXCLUDED.genres,
          rating = EXCLUDED.rating,
          votes_count = EXCLUDED.votes_count,
          views = EXCLUDED.views;

        DELETE FROM chapters WHERE id NOT IN (
          SELECT value->>'id' FROM jsonb_array_elements(COALESCE(p->'chapters', '[]'::jsonb))
        );
        INSERT INTO chapters (id, manga_id, number, title, created_at)
        SELECT
          value->>'id',
          value->>'mangaId',
          (value->>'number')::double precision,
          value->>'title',
          COALESCE((value->>'createdAt')::timestamptz, NOW())
        FROM jsonb_array_elements(COALESCE(p->'chapters', '[]'::jsonb))
        ON CONFLICT (id) DO UPDATE SET
          number = EXCLUDED.number,
          title = EXCLUDED.title;

        DELETE FROM chapter_uploads WHERE id NOT IN (
          SELECT value->>'id' FROM jsonb_array_elements(COALESCE(p->'chapterUploads', '[]'::jsonb))
        );
        INSERT INTO chapter_uploads (id, chapter_id, manga_id, manga_slug, manga_title, manga_cover, manga_type, manga_demography, chapter_number, chapter_title, scanlation_id, scanlation_name, uploader_id, uploader_username, language, pages, views, created_at)
        SELECT
          value->>'id',
          value->>'chapterId',
          value->>'mangaId',
          value->>'mangaSlug',
          value->>'mangaTitle',
          value->>'mangaCover',
          value->>'mangaType',
          value->>'mangaDemography',
          (value->>'chapterNumber')::double precision,
          value->>'chapterTitle',
          value->>'scanlationId',
          value->>'scanlationName',
          value->>'uploaderId',
          value->>'uploaderUsername',
          COALESCE(value->>'language', 'ES'),
          COALESCE(value->'pages', '[]'::jsonb),
          COALESCE((value->>'views')::int, 1),
          COALESCE((value->>'createdAt')::timestamptz, NOW())
        FROM jsonb_array_elements(COALESCE(p->'chapterUploads', '[]'::jsonb))
        ON CONFLICT (id) DO UPDATE SET
          chapter_title = EXCLUDED.chapter_title,
          pages = EXCLUDED.pages,
          views = EXCLUDED.views;

        DELETE FROM manga_comments WHERE id NOT IN (
          SELECT value->>'id' FROM jsonb_array_elements(COALESCE(p->'mangaComments', '[]'::jsonb))
        );
        INSERT INTO manga_comments (id, manga_id, chapter_number, user_id, author_name, author_role, content, likes, spoiler, created_at)
        SELECT
          value->>'id',
          value->>'mangaId',
          CASE WHEN value->>'chapterNumber' IS NOT NULL THEN (value->>'chapterNumber')::double precision ELSE NULL END,
          value->>'userId',
          value->>'authorName',
          value->>'authorRole',
          value->>'content',
          COALESCE((value->>'likes')::int, 1),
          COALESCE((value->>'spoiler')::boolean, false),
          COALESCE((value->>'createdAt')::timestamptz, NOW())
        FROM jsonb_array_elements(COALESCE(p->'mangaComments', '[]'::jsonb))
        ON CONFLICT (id) DO UPDATE SET
          content = EXCLUDED.content,
          likes = EXCLUDED.likes,
          spoiler = EXCLUDED.spoiler;

        DELETE FROM user_library WHERE id NOT IN (
          SELECT value->>'id' FROM jsonb_array_elements(COALESCE(p->'userLibrary', '[]'::jsonb))
        );
        INSERT INTO user_library (id, user_id, manga_id, status, last_read_chapter, last_read_upload_id, updated_at)
        SELECT
          value->>'id',
          value->>'userId',
          value->>'mangaId',
          value->>'status',
          CASE WHEN value->>'lastReadChapter' IS NOT NULL THEN (value->>'lastReadChapter')::double precision ELSE NULL END,
          value->>'lastReadUploadId',
          COALESCE((value->>'updatedAt')::timestamptz, NOW())
        FROM jsonb_array_elements(COALESCE(p->'userLibrary', '[]'::jsonb))
        ON CONFLICT (id) DO UPDATE SET
          status = EXCLUDED.status,
          last_read_chapter = EXCLUDED.last_read_chapter,
          last_read_upload_id = EXCLUDED.last_read_upload_id,
          updated_at = EXCLUDED.updated_at;
      END;
      $func$;
    END $$;
  `);

  if (res.ok) {
    relationalSchemaInitialized = true;
  }
  return res.ok;
}

export const RELATIONAL_TABLES = [
  "users",
  "sessions",
  "scanlations",
  "scanlation_members",
  "uploader_requests",
  "mangas",
  "chapters",
  "chapter_uploads",
  "manga_comments",
  "user_library",
] as const;

export function getCloudInfrastructureStatus() {
  const configured = isNeonConfigured();
  const hasHyperdrive = Boolean(getHyperdriveConnectionString());
  const r2Cfg = getR2Config();
  return {
    neonConfigured: configured,
    neonDatabaseName: isLocalTest() ? "kuramanga_test (PostgreSQL local)" : hasHyperdrive
      ? "BD-mangas (Neon HTTP + Hyperdrive)"
      : process.env.NEON_DATABASE_NAME || "BD-mangas (Neon HTTP)",
    neonSchemaMode: "Relacional Normalizado (10 tablas SQL)",
    neonTables: RELATIONAL_TABLES,
    neonHost: configured
      ? (() => {
        try {
          return new URL(getDatabaseUrl()).hostname;
        } catch {
          return null;
        }
      })()
      : null,
    r2Configured: isR2Configured(),
    r2Mode: r2Cfg.hasNativeBinding
      ? "R2 Native Worker Binding (R2_BUCKET)"
      : r2Cfg.hasS3Credentials
        ? "S3 API (AWS Signature V4)"
        : "No configurado",
    r2Bucket: r2Cfg.bucketName,
    r2PublicUrl: r2Cfg.publicUrl,
  };
}

export async function atomicIncrementViews(
  mangaId: string,
  uploadId?: string
): Promise<{ mangaViews?: number; uploadViews?: number }> {
  if (!isNeonConfigured()) {
    return {};
  }
  try {
    const results: { mangaViews?: number; uploadViews?: number } = {};
    if (mangaId) {
      const mangaRes = await executeNeonQuery<{ views: number }>(
        "UPDATE mangas SET views = COALESCE(views, 0) + 1 WHERE id = $1 RETURNING views;",
        [mangaId]
      );
      if (mangaRes.ok && mangaRes.rows.length > 0) {
        results.mangaViews = mangaRes.rows[0].views;
      }
    }
    if (uploadId) {
      const uploadRes = await executeNeonQuery<{ views: number }>(
        "UPDATE chapter_uploads SET views = COALESCE(views, 0) + 1 WHERE id = $1 RETURNING views;",
        [uploadId]
      );
      if (uploadRes.ok && uploadRes.rows.length > 0) {
        results.uploadViews = uploadRes.rows[0].views;
      }
    }
    return results;
  } catch (err) {
    console.error("Error atomicIncrementViews:", err);
    return {};
  }
}

