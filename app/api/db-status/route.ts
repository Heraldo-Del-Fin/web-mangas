import { NextResponse } from "next/server";
import { readDatabase } from "@/lib/data";
import {
  ensureNeonStoreTable,
  executeNeonQuery,
  getCloudInfrastructureStatus,
} from "@/lib/neon-db";
import { checkR2Connection } from "@/lib/r2-storage";

export async function GET() {
  const infra = getCloudInfrastructureStatus();
  const tableOk = await ensureNeonStoreTable();

  const [ping, tablesRes, r2Status, db] = await Promise.all([
    executeNeonQuery<{ now: string }>("SELECT NOW()::text as now;"),
    executeNeonQuery<{ table_name: string }>(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name;"
    ),
    checkR2Connection(),
    readDatabase(),
  ]);

  const activeTables = tablesRes.rows.map((r) => r.table_name);

  return NextResponse.json({
    ok: ping.ok && r2Status.ok,
    neon: {
      connected: ping.ok,
      driver: ping.driver ?? null,
      timestamp: ping.rows[0]?.now ?? null,
      schemaReady: tableOk,
      activeTables,
      error: ping.error ?? null,
    },
    r2: r2Status,
    infrastructure: infra,
    counts: {
      mangas: db.mangas.length,
      scanlations: db.scanlations.length,
      users: db.users.length,
      uploaderRequests: db.uploaderRequests.length,
    },
  });
}
