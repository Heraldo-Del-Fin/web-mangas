import { test } from "node:test";
import assert from "node:assert/strict";
import { selectPanelData } from "../lib/panel-data.ts";
import { PUBLIC_REGISTRATION_ROLE, secureSessionCookie, serializeJsonLd } from "../lib/security-policy.ts";

const member = (id, scanlationId, userId, role = "SCAN_UPLOADER") => ({
  id, scanlationId, userId, role, username: userId, email: `${userId}@example.invalid`,
  scanlationName: scanlationId, addedAt: "2026-01-01",
});
const db = {
  users: [{ id: "other", username: "other", email: "private@example.invalid", passwordHash: "never-serialize-hash", role: "ADMIN", createdAt: "2026-01-01" }],
  sessions: [{ token: "never-serialize-session" }],
  scanlations: [{ id: "a" }, { id: "b" }],
  scanlationMembers: [member("1", "a", "member-a"), member("2", "b", "member-b")],
  uploaderRequests: [{ id: "mine", userId: "viewer", reason: "own reason" }, { id: "other", userId: "other", reason: "private request" }],
  mangas: [{ id: "m", slug: "m", title: "Title", coverUrl: "/cover.png", type: "MANGA", status: "EN_PUBLICACION", chapters: [{ uploads: ["private pages"] }], comments: ["unneeded comment"] }],
};
const viewer = (role = "READER", memberships = []) => ({ id: "viewer", role, memberships, canUpload: role !== "READER" || memberships.length > 0 });

test("lector recibe solo sus solicitudes, sin directorio, grupos ni catálogo administrativo", () => {
  const data = selectPanelData(db, viewer());
  assert.deepEqual(data.allRequests.map((r) => r.id), ["mine"]);
  assert.deepEqual(data.allUsers, []);
  assert.deepEqual(data.allMembers, []);
  assert.deepEqual(data.allScanlations, []);
  assert.deepEqual(data.allMangas, []);
  for (const secret of ["private@example.invalid", "private request", "never-serialize-session", "never-serialize-hash"]) {
    assert.ok(!JSON.stringify(data).includes(secret));
  }
});
test("líder recibe solo los miembros y grupos que administra, sin correos ajenos", () => {
  const data = selectPanelData(db, viewer("READER", [member("leader", "a", "viewer", "SCAN_LEADER"), member("uploader", "b", "viewer")]));
  assert.deepEqual(data.allScanlations.map((s) => s.id), ["a"]);
  assert.deepEqual(data.allMembers.map((m) => m.id), ["1"]);
  assert.equal(data.allMembers[0].email, "");
  assert.deepEqual(data.allUsers, []);
  assert.deepEqual(data.allRequests.map((r) => r.id), ["mine"]);
});
test("uploader recibe catálogo mínimo, sin usuarios ni detalles de capítulos", () => {
  const data = selectPanelData(db, viewer("UPLOADER"));
  assert.equal(data.allMangas[0].chapterCount, 1);
  assert.ok(!("chapters" in data.allMangas[0]));
  assert.ok(!("comments" in data.allMangas[0]));
  assert.deepEqual(data.allUsers, []);
  assert.deepEqual(data.allMembers, []);
});
test("administrador conserva gestión, sin hashes ni tokens en los datos enviados", () => {
  const data = selectPanelData(db, viewer("ADMIN"));
  assert.equal(data.allUsers[0].email, "private@example.invalid");
  assert.equal(data.allRequests.length, 2);
  assert.equal(data.allMembers.length, 2);
  assert.ok(!JSON.stringify(data).includes("never-serialize-hash"));
  assert.ok(!JSON.stringify(data).includes("never-serialize-session"));
});
test("JSON-LD no permite cerrar el script y conserva el contenido al parsear", () => {
  const value = { name: '</script><script>alert("x")</script>', description: "<&>\u2028\u2029" };
  const serialized = serializeJsonLd(value);
  assert.ok(!/[<>&\u2028\u2029]/.test(serialized));
  assert.deepEqual(JSON.parse(serialized), value);
});
test("cookie segura en producción y staging, compatible con pruebas HTTP locales", () => {
  assert.equal(secureSessionCookie("production", "production"), true);
  assert.equal(secureSessionCookie("staging", "production"), true);
  assert.equal(secureSessionCookie("", "production"), true);
  assert.equal(secureSessionCookie("local-test", "production"), false);
  assert.equal(secureSessionCookie("local-test", "development"), false);
});
test("el registro público nunca asigna privilegios administrativos", () => {
  assert.equal(PUBLIC_REGISTRATION_ROLE, "READER");
});
