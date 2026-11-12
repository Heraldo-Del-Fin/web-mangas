import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { readLocalTestSettings } from "./local-test.mjs";
import { CHAPTER_WRITE_SCHEMA_SQL } from "../lib/chapter-write-schema.ts";
import { SEO_SCHEMA_SQL } from "../lib/seo-schema.ts";

test("guardado incremental: relaciones, grupo nuevo, permisos y rollback sin tocar otras obras", async () => {
  const { connectionString } = readLocalTestSettings();
  const db = new Client({ connectionString, ssl: false, connectionTimeoutMillis: 5000 });
  const schema = `chapter_test_${randomUUID().replaceAll("-", "")}`;
  try {
    await db.connect();
    await db.query("BEGIN");
    await db.query(`CREATE SCHEMA ${schema}; SET LOCAL search_path TO ${schema}`);
    for (const table of ["users", "mangas", "scanlations", "scanlation_members", "chapters", "chapter_uploads"]) {
      await db.query(`CREATE TABLE ${table} (LIKE public.${table} INCLUDING ALL)`);
    }
    await db.query("CREATE TABLE kurumanga_schema_migrations(id text PRIMARY KEY)");
    await db.query(SEO_SCHEMA_SQL);
    await db.query(CHAPTER_WRITE_SCHEMA_SQL);
    await db.query(CHAPTER_WRITE_SCHEMA_SQL);
    await db.query(`INSERT INTO users(id,username,email,password_hash,role) VALUES
      ('admin','Admin','admin@test.invalid','test','ADMIN'),('reader','Reader','reader@test.invalid','test','READER');
      INSERT INTO mangas(id,slug,title,synopsis,cover_url,type,demography,status,author,artist) VALUES
      ('m','m','M','Synopsis','/cover','MANGA','SHOUNEN','EN_PUBLICACION','A','A'),
      ('other','other','Other','Synopsis','/cover','MANGA','SHOUNEN','EN_PUBLICACION','A','A');
      INSERT INTO scanlations(id,name,slug) VALUES('scan-1','Scan','scan');`);
    await db.query("UPDATE mangas SET updated_at='2000-01-01'; UPDATE scanlations SET updated_at='2000-01-01'");
    const before = (await db.query("SELECT row_to_json(m) AS data FROM mangas m WHERE id='other'")).rows;
    let sequence = 0;
    const save = async (overrides = {}) => {
      sequence++;
      const payload = {
        userId: "admin", mangaId: "m", number: 1, title: "Capítulo 1", scanId: "scan-1",
        customScanName: "", pages: ["https://example.invalid/page1.webp", "https://example.invalid/page2.webp"],
        newScanId: `scan-${sequence}`, newScanSlug: `scan-${sequence}`, memberId: `sm-${sequence}`,
        chapterId: `ch-${sequence}`, uploadId: `up-${sequence}`, ...overrides,
      };
      return (await db.query("SELECT insert_kuramanga_chapter($1::jsonb) AS data", [JSON.stringify(payload)])).rows[0].data;
    };
    const first = await save();
    assert.deepEqual(first, { uploadId: "up-1", mangaSlug: "m" });
    await save(); // A second translation uses the existing chapter.
    assert.equal((await db.query("SELECT count(*)::int AS n FROM chapters")).rows[0].n, 1);
    const upload = (await db.query("SELECT * FROM chapter_uploads WHERE id='up-1'")).rows[0];
    assert.equal(upload.chapter_id, "ch-1");
    assert.equal(upload.manga_id, "m");
    assert.equal(upload.scanlation_id, "scan-1");
    assert.equal(upload.uploader_id, "admin");
    assert.equal(upload.pages.length, 2);
    assert.ok((await db.query("SELECT updated_at FROM mangas WHERE id='m'")).rows[0].updated_at > new Date("2000-01-01"));
    assert.ok((await db.query("SELECT updated_at FROM scanlations WHERE id='scan-1'")).rows[0].updated_at > new Date("2000-01-01"));
    assert.equal((await db.query("SELECT uploads_count FROM scanlations WHERE id='scan-1'")).rows[0].uploads_count, 2);
    await save({ scanId: "", customScanName: "Nuevo grupo", number: 2 });
    assert.equal((await db.query("SELECT role FROM scanlation_members WHERE scanlation_id='scan-3'")).rows[0].role, "SCAN_LEADER");
    assert.deepEqual((await db.query("SELECT row_to_json(m) AS data FROM mangas m WHERE id='other'")).rows, before);
    for (const overrides of [{ userId: "reader" }, { mangaId: "missing" }, { scanId: "missing" }, { pages: [] }, { uploadId: "up-1", number: 9, scanId: "", customScanName: "Must roll back" }]) {
      await db.query("SAVEPOINT invalid_upload");
      await assert.rejects(save(overrides));
      await db.query("ROLLBACK TO SAVEPOINT invalid_upload");
    }
    assert.equal((await db.query("SELECT count(*)::int AS n FROM chapters")).rows[0].n, 2);
    assert.equal((await db.query("SELECT count(*)::int AS n FROM chapter_uploads")).rows[0].n, 3);
    assert.equal((await db.query("SELECT count(*)::int AS n FROM scanlations")).rows[0].n, 2);
  } finally {
    await db.query("ROLLBACK").catch(() => {});
    await db.end().catch(() => {});
  }
});
