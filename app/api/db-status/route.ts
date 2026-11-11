import { NextResponse } from "next/server";
import { readDatabase } from "@/lib/data";
import {
  ensureNeonStoreTable,
  executeNeonQuery,
  getCloudInfrastructureStatus,
} from "@/lib/neon-db";

export async function GET() {
  const infra = getCloudInfrastructureStatus();
  const tableOk = await ensureNeonStoreTable();
  const ping = await executeNeonQuery<{ now: string }>("SELECT NOW()::text as now;");
  const db = await readDatabase();

  return NextResponse.json({
    ok: ping.ok,
    timestamp: ping.rows[0]?.now ?? null,
    error: ping.error ?? null,
    infrastructure: infra,
    tableReady: tableOk,
    counts: {
      mangas: db.mangas.length,
      scanlations: db.scanlations.length,
      users: db.users.length,
    },
  });
}

