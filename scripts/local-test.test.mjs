import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validateLocalDatabaseUrl, isSafeLocalAssetKey } from "../lib/local-test-config.ts";
import { validateLocalWorkerConfig } from "./local-test.mjs";

test("solo permite loopback y base kuramanga_test", () => {
  assert.equal(validateLocalDatabaseUrl("postgresql://u:p@localhost:5432/kuramanga_test"), "postgresql://u:p@127.0.0.1:5432/kuramanga_test");
  for (const value of [
    "", "postgresql://u:p@production.neon.tech/kuramanga_test",
    "postgresql://u:p@127.0.0.1/postgres", "postgresql://u:p@127.0.0.1/neondb",
    "postgresql://u:p@127.0.0.1/kuramanga_test?host=production.neon.tech",
    "postgresql://u:p@127.0.0.1/kuramanga_test?options=anything",
    "postgresql://u:p@127.0.0.1/kuramanga_test?sslmode=require",
  ]) assert.throws(() => validateLocalDatabaseUrl(value));
});

test("configuración local impide bindings remotos y rutas de producción", () => {
  const config = JSON.parse(readFileSync(new URL("../config/local/wrangler.json", import.meta.url), "utf8"));
  assert.doesNotThrow(() => validateLocalWorkerConfig(config));
  for (const change of [
    (c) => { c.r2_buckets[0].remote = true; },
    (c) => { c.r2_buckets[0].bucket_name = "db-mangas"; },
    (c) => { c.hyperdrive = [{ binding: "bd-manga", id: "production" }]; },
    (c) => { c.routes = ["example.com/*"]; },
    (c) => { c.dev.ip = "0.0.0.0"; },
    (c) => { c.vars.DATABASE_URL = "secret"; },
  ]) {
    const modified = structuredClone(config); change(modified);
    assert.throws(() => validateLocalWorkerConfig(modified));
  }
});

test("imágenes locales rechazan traversal, extensiones activas y separadores inválidos", () => {
  assert.equal(isSafeLocalAssetKey("chapters/obra-1/cap-1/001-test.webp"), true);
  for (const key of ["../x.png", "a/../../x.jpg", "a\\x.png", "a//x.png", "a/x.html", "a/x.svg", "a/%2e%2e/x.png", ""]) {
    assert.equal(isSafeLocalAssetKey(key), false);
  }
});
