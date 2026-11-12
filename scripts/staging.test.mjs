import { test } from "node:test";
import assert from "node:assert/strict";
import { validateStagingConfig } from "./staging.mjs";
import { validateStagingDatabase } from "../lib/runtime-environment.ts";

const production = {
  name: "kurumanga",
  vars: { DATABASE_HOST: "ep-production.neon.tech", R2_PUBLIC_URL: "https://production.example" },
  r2_buckets: [{ bucket_name: "db-mangas" }],
};
function staging() {
  return {
    name: "kurumanga-staging",
    vars: { APP_ENV: "staging", STAGING_DATABASE_HOST: "ep-testing.neon.tech", R2_PUBLIC_URL: "https://testing.example", NEXT_PUBLIC_SITE_URL: "https://testing.workers.dev" },
    r2_buckets: [{ binding: "R2_BUCKET", bucket_name: "db-mangas-staging" }],
  };
}
test("acepta configuración aislada", () => assert.doesNotThrow(() => validateStagingConfig(staging(), production)));
test("rechaza host de producción directo y pooler", () => {
  for (const host of ["ep-production.neon.tech", "ep-production-pooler.neon.tech"]) {
    const config = staging(); config.vars.STAGING_DATABASE_HOST = host;
    assert.throws(() => validateStagingConfig(config, production));
  }
});
test("rechaza bucket, rutas, Hyperdrive y secretos de producción", () => {
  for (const change of [
    (c) => { c.r2_buckets[0].bucket_name = "db-mangas"; },
    (c) => { c.routes = ["example.com/*"]; },
    (c) => { c.hyperdrive = [{ binding: "bd-manga", id: "production" }]; },
    (c) => { c.vars.DATABASE_URL = "postgresql://secret"; },
    (c) => { c.vars.R2_PUBLIC_URL = "https://production.example"; },
    (c) => { c.name = "kurumanga"; },
  ]) {
    const config = staging(); change(config);
    assert.throws(() => validateStagingConfig(config, production));
  }
});
test("rechaza marcadores sin configurar", () => {
  const config = staging(); config.vars.R2_PUBLIC_URL = "https://REPLACE_WITH_STAGING_R2_HOST";
  assert.throws(() => validateStagingConfig(config, production));
});

test("runtime staging rechaza conexión ausente, otro host y producción", (t) => {
  const original = { APP_ENV: process.env.APP_ENV, STAGING_DATABASE_HOST: process.env.STAGING_DATABASE_HOST };
  t.after(() => {
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  });
  process.env.APP_ENV = "staging";
  process.env.STAGING_DATABASE_HOST = "ep-testing.neon.tech";
  assert.throws(() => validateStagingDatabase(""));
  assert.throws(() => validateStagingDatabase("postgresql://u:p@ep-other.neon.tech/db"));
  const valid = "postgresql://u:p@ep-testing.neon.tech/db?sslmode=require";
  assert.equal(validateStagingDatabase(valid), valid);
  process.env.STAGING_DATABASE_HOST = "ep-soft-meadow-aojjnt3c-pooler.c-2.ap-southeast-1.aws.neon.tech";
  assert.throws(() => validateStagingDatabase(`postgresql://u:p@${process.env.STAGING_DATABASE_HOST}/db`));
});
