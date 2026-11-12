import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { Client } from "pg";
import { readLocalTestSettings } from "./local-test.mjs";
import { SEO_SCHEMA_SQL } from "../lib/seo-schema.ts";

test("migración SEO idempotente: votos, historial de slugs, fechas y reserva de URLs", async () => {
  const { connectionString } = readLocalTestSettings();
  const client = new Client({ connectionString, ssl: false, connectionTimeoutMillis: 5000 });
  const schema = `seo_test_${randomBytes(8).toString("hex")}`;
  try {
    await client.connect();
    await client.query("BEGIN");
    await client.query(`CREATE SCHEMA ${schema}`);
    await client.query(`SET LOCAL search_path TO ${schema}`);
    await client.query(`
      CREATE TABLE mangas(id text PRIMARY KEY,slug text,title text,rating double precision DEFAULT 5,votes_count int DEFAULT 1,views int DEFAULT 0,created_at timestamptz DEFAULT '2020-01-01');
      CREATE TABLE scanlations(id text PRIMARY KEY,name text);
      CREATE TABLE chapter_uploads(id text PRIMARY KEY,manga_id text,scanlation_id text,pages jsonb DEFAULT '[]',views int DEFAULT 0,created_at timestamptz DEFAULT '2020-01-01');
      INSERT INTO mangas(id,slug,title,rating,votes_count) VALUES('a','old-a','A',5,1),('b','old-b','B',4,3);
      INSERT INTO scanlations VALUES('scan','Scan');
    `);
    await client.query(SEO_SCHEMA_SQL);
    await client.query(SEO_SCHEMA_SQL);
    let rows = (await client.query("SELECT * FROM mangas ORDER BY id")).rows;
    assert.equal(rows[0].votes_count, 0);
    assert.equal(rows[0].rating, 0);
    assert.equal(rows[0].legacy_votes_count, 1);
    assert.equal(rows[1].votes_count, 2);
    assert.equal(rows[1].rating, 3.5);
    await client.query("INSERT INTO mangas(id,slug,title) VALUES('c','new-c','C')");
    rows = (await client.query("SELECT rating,votes_count FROM mangas WHERE id='c'")).rows;
    assert.deepEqual(rows[0], { rating: 0, votes_count: 0 });

    await client.query("UPDATE mangas SET slug='middle-a',title='Edited' WHERE id='a'");
    await client.query("UPDATE mangas SET slug='final-a' WHERE id='a'");
    rows = (await client.query("SELECT r.old_slug,m.slug FROM manga_slug_redirects r JOIN mangas m ON m.id=r.manga_id ORDER BY r.old_slug")).rows;
    assert.deepEqual(rows, [{ old_slug: "middle-a", slug: "final-a" }, { old_slug: "old-a", slug: "final-a" }]);
    const stamp = (await client.query("SELECT updated_at FROM mangas WHERE id='a'")).rows[0].updated_at;
    assert.ok(stamp > new Date("2020-01-01"));
    await client.query("UPDATE mangas SET views=views+1 WHERE id='a'");
    assert.equal((await client.query("SELECT updated_at FROM mangas WHERE id='a'")).rows[0].updated_at.getTime(), stamp.getTime());
    await client.query("SAVEPOINT reserved_slug");
    await assert.rejects(client.query("INSERT INTO mangas(id,slug,title) VALUES('x','old-a','X')"), (error) => error.code === "23505");
    await client.query("ROLLBACK TO SAVEPOINT reserved_slug");
    await client.query("INSERT INTO chapter_uploads(id,manga_id,scanlation_id) VALUES('up','a','scan')");
    assert.ok((await client.query("SELECT updated_at FROM scanlations WHERE id='scan'")).rows[0].updated_at);
    assert.equal((await client.query("SELECT count(*)::int AS n FROM kurumanga_schema_migrations")).rows[0].n, 1);
  } finally {
    // This rolls back the isolated schema, test records and migration together.
    await client.query("ROLLBACK").catch(() => {});
    await client.end().catch(() => {});
  }
});
