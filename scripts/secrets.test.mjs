import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { findSecrets } from "./check-secrets.mjs";
import { requireDatabaseUrl } from "../lib/database-config.ts";
import { isProductionRuntime } from "../lib/runtime-environment.ts";
import { publicWorkerEnvironment } from "./worker-artifact.mjs";

test("detecta credenciales sin devolver sus valores", () => {
  const credential = "npg_" + "x".repeat(12);
  const text = 'DATABASE_URL="' + 'postgresql://' + 'user:' + credential + '@host/db"\nR2_SECRET_ACCESS_KEY="' + "a".repeat(64) + '"';
  const findings = findSecrets(text);
  assert.ok(findings.some((f) => f.rule === "Conexión PostgreSQL"));
  assert.ok(findings.some((f) => f.rule === "Token Neon"));
  assert.ok(findings.some((f) => f.rule === "Clave R2" && f.line === 2));
  assert.ok(!JSON.stringify(findings).includes(credential));
});
test("permite ejemplos explícitos y rechaza conexiones sin configurar", () => {
  assert.equal(findSecrets('DATABASE_URL="postgresql://user:tu_password@host/db"').length, 0);
  for (const value of ["", "bad-url", "https://user:p@host/db", "postgresql://host/db"]) {
    assert.throws(() => requireDatabaseUrl(value), /DATABASE_URL/);
  }
  const valid = "postgresql://user:p@host/db?sslmode=require&channel_binding=require";
  assert.equal(requireDatabaseUrl(valid), valid);
});
test("producción no contiene secretos en vars y usa solo un placeholder local de Hyperdrive", () => {
  const config = JSON.parse(readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8"));
  for (const key of ["DATABASE_URL", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY"]) assert.ok(!(key in config.vars));
  assert.equal(config.vars.APP_ENV, "production");
  assert.ok(config.vars.DATABASE_HOST);
  for (const binding of config.hyperdrive ?? []) {
    assert.equal(binding.localConnectionString, "postgresql://build:password@127.0.0.1:1/opennext_build");
  }
  assert.equal(config.r2_buckets[0].binding, "R2_BUCKET");
});
test("modo producción exige persistencia remota excepto durante build", (t) => {
  const original = Object.fromEntries(["APP_ENV", "NODE_ENV", "NEXT_PHASE"].map((key) => [key, process.env[key]]));
  t.after(() => {
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  });
  process.env.APP_ENV = "production";
  delete process.env.NEXT_PHASE;
  assert.equal(isProductionRuntime(), true);
  process.env.NEXT_PHASE = "phase-production-build";
  assert.equal(isProductionRuntime(), false);
  delete process.env.NEXT_PHASE;
  process.env.APP_ENV = "local-test";
  assert.equal(isProductionRuntime(), false);
});

test("excluye variables privadas y conserva solo la URL pública del artefacto", () => {
  assert.deepEqual(publicWorkerEnvironment({
    DATABASE_URL: "private", R2_SECRET_ACCESS_KEY: "private", OTHER_TOKEN: "private",
    NEXT_PUBLIC_SITE_URL: "https://example.invalid",
  }), { NEXT_PUBLIC_SITE_URL: "https://example.invalid" });
  assert.deepEqual(publicWorkerEnvironment({ DATABASE_URL: "private" }), {});
});
