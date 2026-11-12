import { readFileSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { sanitizeWorkerArtifact } from "./worker-artifact.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));

export function validateStagingConfig(config, production) {
  const vars = config.vars ?? {};
  if (config.name !== "kurumanga-staging" || config.name === production.name ||
      config.routes?.length || config.route || config.hyperdrive?.length ||
      config.services?.length || vars.APP_ENV !== "staging") {
    throw new Error("Worker de staging inválido: nombre, rutas o bindings no aislados.");
  }
  const bindings = config.r2_buckets ?? [];
  if (bindings.length !== 1 || bindings[0].binding !== "R2_BUCKET" ||
      bindings[0].bucket_name !== "db-mangas-staging" ||
      production.r2_buckets?.some((b) => b.bucket_name === bindings[0].bucket_name)) {
    throw new Error("El binding R2 debe usar exclusivamente db-mangas-staging.");
  }
  const host = vars.STAGING_DATABASE_HOST;
  const productionHost = production.vars.DATABASE_HOST;
  if (!productionHost) throw new Error("Falta DATABASE_HOST público en la configuración de producción.");
  if (!host || !/^ep-[a-z0-9.-]+\.neon\.tech$/.test(host) ||
      host.replace("-pooler.", ".") === productionHost.replace("-pooler.", ".")) {
    throw new Error("Configura STAGING_DATABASE_HOST con el host Neon aislado.");
  }
  for (const key of ["R2_PUBLIC_URL", "NEXT_PUBLIC_SITE_URL"]) {
    const url = new URL(vars[key]);
    if (url.protocol !== "https:" || vars[key].includes("REPLACE_WITH") ||
        url.username || url.password || url.search || url.hash) {
      throw new Error(`Configura ${key} con la URL HTTPS de staging.`);
    }
  }
  if (vars.R2_PUBLIC_URL.replace(/\/$/, "") === production.vars.R2_PUBLIC_URL.replace(/\/$/, "") ||
      new URL(vars.NEXT_PUBLIC_SITE_URL).hostname === "kurumanga.dheraldo.workers.dev") {
    throw new Error("Staging no puede reutilizar las URLs de producción.");
  }
  for (const key of ["DATABASE_URL", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY"]) {
    if (key in vars) throw new Error(`Usa un secret de Worker para ${key}.`);
  }
}

function main() {
  const action = process.argv[2];
  if (!["check", "build", "deploy", "preview"].includes(action)) {
    throw new Error("Acción válida: check, build, deploy o preview.");
  }
  const config = JSON.parse(readFileSync(path.join(root, "wrangler.staging.json"), "utf8"));
  const production = JSON.parse(readFileSync(path.join(root, "wrangler.jsonc"), "utf8"));
  validateStagingConfig(config, production);
  // OpenNext and Next load local env files. Refuse ambiguous build inputs.
  const conflicting = readdirSync(root).filter((name) =>
    (name === ".env" || name.startsWith(".env.") || name.startsWith(".dev.vars")) &&
    name !== ".env.example");
  if (conflicting.length) {
    throw new Error(`Retira temporalmente del proyecto estos archivos antes de staging: ${conflicting.join(", ")}`);
  }
  console.log("Configuración de staging aislada. Aún debe comprobarse en Cloudflare y Neon.");
  if (action === "check") return;
  const env = {
    ...process.env,
    DATABASE_URL: "",
    R2_ACCESS_KEY_ID: "",
    R2_SECRET_ACCESS_KEY: "",
    R2_ACCOUNT_ID: "",
    ...config.vars,
    CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV: "false",
  };
  const cli = path.join(root, "node_modules/@opennextjs/cloudflare/dist/cli/index.js");
  function run(command) {
    const result = spawnSync(process.execPath, [cli, command, "--config", "wrangler.staging.json"], {
      cwd: root, env, stdio: "inherit",
    });
    if (result.error) throw result.error;
    if (result.status !== 0) process.exit(result.status ?? 1);
  }
  // Always rebuild before deploy/preview, never reuse a production artifact.
  run("build");
  sanitizeWorkerArtifact(root);
  if (action !== "build") run(action);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); } catch (error) {
    console.error(error instanceof Error ? error.message : "Error en staging.");
    process.exitCode = 1;
  }
}
