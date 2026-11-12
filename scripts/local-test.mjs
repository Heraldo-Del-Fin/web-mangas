import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { Client } from "pg";
import { validateLocalDatabaseUrl } from "../lib/local-test-config.ts";
import { sanitizeWorkerArtifact } from "./worker-artifact.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const localDir = path.join(root, "config/local");
const privateFile = path.join(localDir, ".env.local");
const configFile = path.join(localDir, "wrangler.json");
const stateDir = path.join(root, ".wrangler/local-test");

export function validateLocalWorkerConfig(config) {
  const bindings = config.r2_buckets ?? [];
  if (config.name !== "kuramanga-local-test" || config.workers_dev !== false ||
      config.preview_urls !== false || config.routes?.length || config.route ||
      config.hyperdrive?.length || config.services?.length ||
      config.vars?.APP_ENV !== "local-test" || config.vars?.R2_BUCKET_NAME !== "kuramanga-local-test" ||
      config.vars?.R2_PUBLIC_URL !== "/api/local-assets" ||
      config.vars?.NEXT_PUBLIC_SITE_URL !== "http://127.0.0.1:3000" ||
      config.dev?.ip !== "127.0.0.1" || config.dev?.port !== 3000 ||
      bindings.length !== 1 || bindings[0].binding !== "R2_BUCKET" ||
      bindings[0].bucket_name !== "kuramanga-local-test" || bindings[0].remote !== false ||
      "DATABASE_URL" in config.vars) {
    throw new Error("Configuración local no aislada. Revisa config/local/wrangler.json.");
  }
}

function run(file, args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(file, args, { cwd: root, env, stdio: "inherit", windowsHide: true });
    const interrupt = () => { child.kill("SIGINT"); };
    process.on("SIGINT", interrupt);
    child.once("error", (error) => { process.removeListener("SIGINT", interrupt); reject(error); });
    child.once("exit", (code, signal) => {
      process.removeListener("SIGINT", interrupt);
      if (code === 0) resolve(); else reject(new Error(`El proceso terminó (${signal ?? code}).`));
    });
  });
}

async function checkDatabase(connectionString) {
  const client = new Client({ connectionString, ssl: false, connectionTimeoutMillis: 5000 });
  try {
    await client.connect();
    const { rows } = await client.query("SELECT current_database() AS db, host(inet_server_addr()) AS host, version() AS version");
    if (rows[0]?.db !== "kuramanga_test" || !["127.0.0.1", "::1"].includes(rows[0]?.host)) {
      throw new Error("La conexión no corresponde a PostgreSQL local kuramanga_test.");
    }
    console.log(`PostgreSQL local OK: ${rows[0].db} (${rows[0].host}).`);
  } finally {
    await client.end().catch(() => {});
  }
}

export function readLocalTestSettings() {
  if (!process.env.LOCAL_DATABASE_URL && !existsSync(privateFile)) throw new Error("Primero ejecuta npm run setup:local.");
  const values = process.env.LOCAL_DATABASE_URL
    ? { LOCAL_DATABASE_URL: process.env.LOCAL_DATABASE_URL }
    : parseEnv(readFileSync(privateFile, "utf8"));
  if (Object.keys(values).some((key) => key !== "LOCAL_DATABASE_URL") || values.LOCAL_DATABASE_URL?.includes("REPLACE_PASSWORD")) {
    throw new Error("Configura únicamente LOCAL_DATABASE_URL en config/local/.env.local.");
  }
  const connectionString = validateLocalDatabaseUrl(values.LOCAL_DATABASE_URL ?? "");
  const config = JSON.parse(readFileSync(configFile, "utf8"));
  validateLocalWorkerConfig(config);
  return { connectionString, config };
}

async function main() {
  const action = process.argv[2];
  if (!["setup", "check", "dev", "build", "preview"].includes(action)) {
    throw new Error("Acción local válida: setup, check, dev, build o preview. No se admite deploy.");
  }
  if (action === "setup") {
    if (!existsSync(privateFile)) {
      writeFileSync(privateFile, readFileSync(path.join(localDir, ".env.example")), { flag: "wx" });
    }
    console.log("Edita config/local/.env.local con tus credenciales PostgreSQL. Crea la base kuramanga_test en pgAdmin y ejecuta npm run check:local.");
    return;
  }
  const { connectionString, config } = readLocalTestSettings();
  await checkDatabase(connectionString);
  if (action === "check") return;
  mkdirSync(stateDir, { recursive: true });
  // Stored only next to the local config, never in the production config.
  writeFileSync(path.join(localDir, ".dev.vars"), `DATABASE_URL=${JSON.stringify(connectionString)}\n`, { mode: 0o600 });
  const env = {
    ...process.env,
    ...config.vars,
    DATABASE_URL: connectionString,
    R2_ACCOUNT_ID: "", R2_ACCESS_KEY_ID: "", R2_SECRET_ACCESS_KEY: "",
    STAGING_DATABASE_HOST: "",
    PGSSLMODE: "disable",
    CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV: "false",
    WRANGLER_SEND_METRICS: "false",
    NEXT_TELEMETRY_DISABLED: "1",
    NODE_ENV: action === "dev" ? "development" : "production",
  };
  console.log("Modo local: PostgreSQL loopback + R2 simulado. No se despliega ningún recurso.");
  if (action === "dev") {
    await run(process.execPath, [path.join(root, "node_modules/next/dist/bin/next"), "dev", "--hostname", "127.0.0.1", "--port", "3000"], env);
    return;
  }
  const cli = path.join(root, "node_modules/@opennextjs/cloudflare/dist/cli/index.js");
  await run(process.execPath, [cli, "build", "--config", configFile], env);
  sanitizeWorkerArtifact(root);
  if (action === "preview") {
    await run(process.execPath, [cli, "preview", "--config", configFile, "--persist-to", stateDir], env);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    // Never print URL/password or connection error objects.
    console.error(error instanceof Error ? error.message : "Error en pruebas locales.");
    process.exitCode = 1;
  });
}
