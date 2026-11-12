import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
export function findSecrets(text) {
  const findings = [];
  const rules = [
    ["Token Neon", /npg_[A-Za-z0-9]{8,}/g],
    ["Clave R2", /R2_(?:SECRET_ACCESS_KEY|ACCESS_KEY_ID)["']?\s*[:=]\s*["']([a-f0-9]{24,64})["']/gi],
    ["Conexión PostgreSQL", /postgres(?:ql)?:\/\/[^\s/:"']+:([^\s@"']+)@/gi],
  ];
  for (const [rule, regex] of rules) {
    for (const match of text.matchAll(regex)) {
      if (rule === "Conexión PostgreSQL" && ["p", "password", "tu_password", "REPLACE_PASSWORD", "TU_PASSWORD", "TU_CONTRASEÑA"].includes(match[1])) continue;
      findings.push({ rule, line: text.slice(0, match.index).split("\n").length });
    }
  }
  return findings;
}

function main() {
  const result = spawnSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard"], { cwd: root, encoding: "utf8", windowsHide: true });
  if (result.status !== 0) throw new Error("No se pudo enumerar el contenido versionable con git.");
  let total = 0;
  for (const file of new Set(result.stdout.split("\0").filter(Boolean))) {
    let bytes;
    try { bytes = readFileSync(path.join(root, file)); } catch { continue; }
    if (bytes.includes(0)) continue;
    for (const finding of findSecrets(bytes.toString("utf8"))) {
      console.error(`${file}:${finding.line}: ${finding.rule} detectado (valor oculto).`);
      total++;
    }
  }
  if (total) throw new Error(`${total} coincidencias sensibles. Retirar y rotar antes de publicar.`);
  console.log("Sin credenciales detectadas por los patrones del escaneo en archivos versionables. No revisa historial ni archivos ignorados.");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); } catch (error) {
    console.error(error instanceof Error ? error.message : "Error del escaneo.");
    process.exitCode = 1;
  }
}
