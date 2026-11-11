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
  const [tableOk, ping, r2Status, db] = await Promise.all([
    ensureNeonStoreTable(),
    executeNeonQuery<{ now: string }>("SELECT NOW()::text as now;"),
    checkR2Connection(),
    readDatabase(),
  ]);

  return NextResponse.json({
    ok: ping.ok && r2Status.ok,
    neon: {
      connected: ping.ok,
      driver: ping.driver ?? null,
      timestamp: ping.rows[0]?.now ?? null,
      tableReady: tableOk,
      error: ping.error ?? null,
    },
    r2: r2Status,
    infrastructure: infra,
    counts: {
      mangas: db.mangas.length,
      scanlations: db.scanlations.length,
      users: db.users.length,
    },
  });
}
