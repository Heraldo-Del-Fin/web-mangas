import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { Client } from "pg";
import { readLocalTestSettings } from "./local-test.mjs";

async function main() {
  const { connectionString, config } = readLocalTestSettings();
  const base = config.vars.NEXT_PUBLIC_SITE_URL;
  const request = (route, init = {}) => fetch(`${base}${route}`, { ...init, signal: AbortSignal.timeout(30000) });
  const response = await request("/api/db-status");
  assert.equal(response.status, 200, "El diagnóstico local debe responder 200; revisa el registro del servidor.");
  const health = await response.json();
  assert.equal(health.neon.driver, "local-pg");
  assert.ok(["127.0.0.1", "[::1]"].includes(health.infrastructure.neonHost));
  assert.equal(health.r2.bucket, "kuramanga-local-test");
  assert.equal(health.ok, true);
  console.log("OK: PostgreSQL y R2 locales.");

  const denied = await request("/api/upload-page", { method: "POST" });
  assert.equal(denied.status, 403, "Una subida sin sesión debe ser rechazada.");
  const db = new Client({ connectionString, ssl: false, connectionTimeoutMillis: 5000 });
  const id = `local-smoke-${randomUUID()}`;
  const token = randomBytes(32).toString("hex");
  try {
    await db.connect();
    await db.query("INSERT INTO users(id,username,email,password_hash,role) VALUES($1,$2,$3,$4,$5)", [id, id, `${id}@example.invalid`, "disabled:disabled", "ADMIN"]);
    await db.query("INSERT INTO sessions(token,user_id,expires_at) VALUES($1,$2,NOW()+INTERVAL '5 minutes')", [token, id]);
    const image = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=", "base64");
    const form = new FormData();
    form.set("file", new File([image], "smoke.png", { type: "image/png" }));
    form.set("mangaSlug", id); form.set("chapterNumber", "1"); form.set("pageIndex", "0");
    const uploadResponse = await request("/api/upload-page", { method: "POST", headers: { Cookie: `kuramanga_session=${token}` }, body: form });
    assert.equal(uploadResponse.status, 200, "La subida con sesión de prueba debe funcionar.");
    const upload = await uploadResponse.json();
    assert.ok(upload.url.startsWith("/api/local-assets/"));
    const savedImage = await request(upload.url);
    assert.equal(savedImage.status, 200);
    assert.deepEqual(Buffer.from(await savedImage.arrayBuffer()), image);
    console.log("OK: permiso de subida, sesión de prueba y lectura de imagen.");

    const home = await request("/");
    assert.equal(home.status, 200);
    assert.match(home.headers.get("x-robots-tag"), /noindex/);
    assert.ok(!(await home.text()).includes("pagead2.googlesyndication.com"));
    const robots = await request("/robots.txt");
    assert.match(await robots.text(), /Disallow: \//);
    console.log("OK: portada, noindex, robots y anuncios desactivados.");
  } finally {
    // Only remove the random records created by this run, never user accounts.
    try {
      await db.query("DELETE FROM sessions WHERE token=$1", [token]);
      await db.query("DELETE FROM users WHERE id=$1", [id]);
    } finally { await db.end().catch(() => {}); }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Error de comprobación local.");
  process.exitCode = 1;
});
