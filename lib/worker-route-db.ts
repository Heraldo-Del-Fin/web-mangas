import { Socket } from "node:net";
import { Client } from "pg";
import { validateLocalDatabaseUrl } from "./local-test-config";
import { requireDatabaseUrl } from "./database-config";

export interface RouteEnvironment {
  APP_ENV?: string;
  DATABASE_URL?: string;
  STAGING_DATABASE_HOST?: string;
  "bd-manga"?: { connectionString: string };
}

// This runs before OpenNext initializes its request context. Read bindings directly.
export async function routeQuery(env: RouteEnvironment, query: string, params: string[]) {
  const local = env.APP_ENV === "local-test";
  const connectionString = local
    ? validateLocalDatabaseUrl(env.DATABASE_URL ?? "")
    : requireDatabaseUrl(env.DATABASE_URL ?? "");
  const hostname = new URL(connectionString).hostname;
  if (env.APP_ENV === "staging" && hostname !== env.STAGING_DATABASE_HOST) {
    throw new Error("La base no corresponde al entorno de pruebas.");
  }
  if (!local) {
    try {
      const response = await fetch(`https://${hostname}/sql`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Neon-Connection-String": connectionString },
        body: JSON.stringify({ query, params }),
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) throw new Error("Consulta HTTP no disponible.");
      const result = await response.json() as { rows?: Record<string, string>[]; severity?: string };
      if (!Array.isArray(result.rows) || result.severity === "ERROR") throw new Error("Consulta rechazada.");
      return result.rows;
    } catch {
      if (env.APP_ENV !== "production" || !env["bd-manga"]?.connectionString) {
        throw new Error("No se pudo consultar la ruta pública.");
      }
    }
  }
  const client = new Client({
    connectionString: local ? connectionString : env["bd-manga"]!.connectionString,
    ...(local ? { ssl: false } : {}),
    stream: () => new Socket(), connectionTimeoutMillis: 5000, query_timeout: 15000,
  });
  try {
    await client.connect();
    return (await client.query<Record<string, string>>(query, params)).rows;
  } finally {
    await client.end().catch(() => {});
  }
}
