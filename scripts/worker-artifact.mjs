import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { findSecrets } from "./check-secrets.mjs";

export function publicWorkerEnvironment(value) {
  // All private runtime values must come from Worker bindings/secrets, not
  // a developer's .env files. Only this project's public site URL is compiled.
  return typeof value.NEXT_PUBLIC_SITE_URL === "string"
    ? { NEXT_PUBLIC_SITE_URL: value.NEXT_PUBLIC_SITE_URL } : {};
}

export function sanitizeWorkerArtifact(root) {
  const file = path.join(root, ".open-next/cloudflare/next-env.mjs");
  const source = readFileSync(file, "utf8");
  const modes = new Map();
  for (const match of source.matchAll(/^export const (production|development|test) = (.+);$/gm)) {
    modes.set(match[1], publicWorkerEnvironment(JSON.parse(match[2])));
  }
  if (modes.size !== 3) throw new Error("Formato de next-env.mjs desconocido; se bloquea el artefacto sin filtrar.");
  writeFileSync(file, [...modes].map(([mode, values]) => `export const ${mode} = ${JSON.stringify(values)};`).join("\n") + "\n");
  let findings = 0;
  for (const entry of readdirSync(path.join(root, ".open-next"), { recursive: true, withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const filePath = path.join(entry.parentPath, entry.name);
    const bytes = readFileSync(filePath);
    if (bytes.includes(0)) continue;
    const matches = findSecrets(bytes.toString("utf8"));
    if (matches.length) {
      console.error(`${path.relative(root, filePath)}: ${matches.length} coincidencias sensibles (valores ocultos).`);
      findings += matches.length;
    }
  }
  if (findings) throw new Error("El artefacto contiene posibles credenciales; no publicar.");
  console.log("Artefacto filtrado: valores privados de .env excluidos y patrones de credenciales revisados.");
}
