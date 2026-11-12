import { test } from "node:test";
import assert from "node:assert/strict";
import { getPlatformProxy } from "wrangler";
import { fileURLToPath } from "node:url";

test("el proxy que usa OpenNext deploy arranca sin PostgreSQL ni secretos de producción", async () => {
  const proxy = await getPlatformProxy({
    configPath: fileURLToPath(new URL("../wrangler.jsonc", import.meta.url)),
    envFiles: [],
    persist: false,
  });
  try {
    const binding = proxy.env["bd-manga"];
    assert.equal(typeof binding?.connectionString, "string");
    assert.ok(binding.connectionString.length > 0);
    assert.ok(!("DATABASE_URL" in proxy.env));
  } finally {
    await proxy.dispose();
  }
});
