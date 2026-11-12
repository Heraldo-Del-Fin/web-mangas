import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { readLocalTestSettings } from "./local-test.mjs";

async function main() {
  const { connectionString, config } = readLocalTestSettings();
  const base = config.vars.NEXT_PUBLIC_SITE_URL;
  const request = (route) => fetch(`${base}${route}`, { redirect: "manual", signal: AbortSignal.timeout(30000) });
  for (const route of ["/manga/seo-missing-resource", "/leer/seo-missing-resource"]) {
    assert.equal((await request(route)).status, 404, `${route} debe devolver 404 real`);
  }
  for (const route of ["/login", "/registro"]) {
    const response = await request(route);
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.match(html, /name="robots" content="noindex, follow"/);
    assert.ok(html.includes(`rel="canonical" href="${base}${route}"`));
    assert.ok(!html.includes('<title>KuruManga — Leer Manga'));
  }
  console.log("OK: 404 reales y metadatos de login/registro.");
  const db = new Client({ connectionString, ssl: false, connectionTimeoutMillis: 5000 });
  const id = `seo-smoke-${randomUUID()}`;
  try {
    await db.connect();
    await db.query(`INSERT INTO mangas(id,slug,title,synopsis,cover_url,type,demography,status,author,artist)
      VALUES($1,$1,'SEO test','Contenido de prueba','/favicon.ico','MANGA','SHOUNEN','EN_PUBLICACION','Test','Test')`, [id]);
    const page = await request(`/manga/${id}`);
    assert.equal(page.status, 200);
    const html = await page.text();
    assert.ok(!html.includes('"aggregateRating":'));
    let row = (await db.query("SELECT rating,votes_count FROM mangas WHERE id=$1", [id])).rows[0];
    assert.equal(row.rating, 0);
    assert.equal(row.votes_count, 0);
    await db.query("UPDATE mangas SET slug=$2 WHERE id=$1", [id, `${id}-middle`]);
    await db.query("UPDATE mangas SET slug=$2,title='Edited SEO test' WHERE id=$1", [id, `${id}-final`]);
    for (const slug of [id, `${id}-middle`]) {
      const response = await request(`/manga/${slug}`);
      assert.equal(response.status, 301);
      assert.equal(new URL(response.headers.get("location"), base).pathname, `/manga/${id}-final`);
    }
    row = (await db.query("SELECT updated_at,created_at FROM mangas WHERE id=$1", [id])).rows[0];
    assert.ok(row.updated_at >= row.created_at);
    console.log("OK: cero votos iniciales, sin aggregateRating y redirecciones 301 sin cadenas.");
  } finally {
    await db.query("DELETE FROM mangas WHERE id=$1", [id]).catch(() => {});
    await db.end().catch(() => {});
  }
}

main().catch((error) => { console.error(error instanceof Error ? error.message : "Error SEO local"); process.exitCode = 1; });
