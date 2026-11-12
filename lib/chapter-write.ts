import { randomUUID } from "node:crypto";
import { ensureNeonStoreTable, executeNeonQuery } from "./neon-db";

export async function saveNewChapter(input: {
  userId: string; mangaId: string; number: number; title: string;
  scanId: string; customScanName: string; pages: string[];
}) {
  if (!await ensureNeonStoreTable()) throw new Error("Base de datos temporalmente no disponible.");
  const newScanId = `scan-${randomUUID()}`;
  const payload = {
    ...input, newScanId, newScanSlug: newScanId,
    memberId: `sm-${randomUUID()}`, chapterId: `ch-${randomUUID()}`, uploadId: `up-${randomUUID()}`,
  };
  const result = await executeNeonQuery<{ data: { uploadId: string; mangaSlug: string } }>(
    "SELECT insert_kuramanga_chapter($1::jsonb) AS data", [JSON.stringify(payload)],
  );
  if (!result.ok || !result.rows[0]?.data) {
    throw new Error("No se pudo guardar el capítulo. Comprueba el grupo y vuelve a intentarlo.");
  }
  return result.rows[0].data;
}
