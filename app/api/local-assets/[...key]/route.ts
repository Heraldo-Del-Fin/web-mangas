import { readLocalTestImage } from "@/lib/r2-storage";

export async function GET(_request: Request, context: { params: Promise<{ key: string[] }> }) {
  const { key } = await context.params;
  return readLocalTestImage(key.join("/"));
}
