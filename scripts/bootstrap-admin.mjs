import { Client } from "pg";
import { readLocalTestSettings } from "./local-test.mjs";

async function main() {
  const userId = process.argv[2];
  if (!userId || process.argv.length !== 3) throw new Error("Uso: npm run bootstrap:admin:local -- ID_USUARIO, con la app detenida. Solo sirve para PostgreSQL local.");
  const { connectionString } = readLocalTestSettings();
  const db = new Client({ connectionString, ssl: false, connectionTimeoutMillis: 5000 });
  try {
    await db.connect();
    await db.query("BEGIN");
    await db.query("SELECT pg_advisory_xact_lock(hashtext('kuramanga-bootstrap-admin'))");
    const existing = await db.query("SELECT id FROM users WHERE role='ADMIN' LIMIT 1");
    if (existing.rows.length) throw new Error("Ya existe un administrador. Usa su panel para cambiar roles.");
    const result = await db.query("UPDATE users SET role='ADMIN' WHERE id=$1 AND role='READER' RETURNING id", [userId]);
    if (!result.rows.length) throw new Error("No existe un lector con ese ID; no se modificó ninguna cuenta.");
    await db.query("COMMIT");
    console.log("Administrador inicial local asignado. Cierra sesión y vuelve a entrar para actualizar los permisos.");
  } catch (error) {
    await db.query("ROLLBACK").catch(() => {});
    throw error;
  } finally { await db.end().catch(() => {}); }
}

main().catch((error) => { console.error(error instanceof Error ? error.message : "No se pudo inicializar el administrador."); process.exitCode = 1; });
