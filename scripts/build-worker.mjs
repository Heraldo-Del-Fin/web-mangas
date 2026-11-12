import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { sanitizeWorkerArtifact } from "./worker-artifact.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const cli = path.join(root, "node_modules/@opennextjs/cloudflare/dist/cli/index.js");
const child = spawn(process.execPath, [cli, "build", ...process.argv.slice(2)], { cwd: root, env: process.env, stdio: "inherit", windowsHide: true });
child.once("error", () => { console.error("No se pudo iniciar OpenNext."); process.exitCode = 1; });
child.once("exit", (code) => {
  if (code !== 0) { process.exitCode = code ?? 1; return; }
  try { sanitizeWorkerArtifact(root); } catch (error) {
    console.error(error instanceof Error ? error.message : "Error validando artefacto.");
    process.exitCode = 1;
  }
});
