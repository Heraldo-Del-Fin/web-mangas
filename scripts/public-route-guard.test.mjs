import { test } from "node:test";
import assert from "node:assert/strict";
import { publicRouteGuard } from "../lib/public-route-guard.ts";

const request = (path, method = "GET") => new Request(`https://example.test${path}`, { method });
test("delega rutas ajenas y obras existentes al servidor", async () => {
  assert.equal(await publicRouteGuard(request("/biblioteca"), () => { throw Error(); }), null);
  assert.equal(await publicRouteGuard(request("/manga/obra"), async () => [{ slug: "obra" }]), null);
  assert.equal(await publicRouteGuard(request("/leer/up-1"), async () => [{ id: "up-1" }]), null);
});
test("devuelve 404 real sin cuerpo para HEAD", async () => {
  for (const path of ["/manga/ausente", "/leer/ausente", "/manga/a/b", "/manga/%ZZ"]) {
    const response = await publicRouteGuard(request(path, "HEAD"), async () => []);
    assert.equal(response.status, 404);
    assert.equal(response.headers.get("x-robots-tag"), "noindex");
    assert.equal(await response.text(), "");
  }
});
test("redirige al slug actual con 301 conservando consulta y origen", async () => {
  const response = await publicRouteGuard(request("/manga/anterior?origen=lista"), async (_sql, params) => {
    assert.deepEqual(params, ["anterior"]);
    return [{ slug: "actual" }];
  });
  assert.equal(response.status, 301);
  assert.equal(response.headers.get("location"), "https://example.test/manga/actual?origen=lista");
});
test("fallos de base producen 503 y nunca un falso 404", async () => {
  const response = await publicRouteGuard(request("/manga/obra"), async () => { throw Error("fallo"); });
  assert.equal(response.status, 503);
  assert.equal(response.headers.get("retry-after"), "60");
});
