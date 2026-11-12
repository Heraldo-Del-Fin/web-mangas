// Pure checks shared by the local launcher and the application runtime.
export function validateLocalDatabaseUrl(value: string): string {
  let url: URL;
  try { url = new URL(value); } catch {
    throw new Error("Configura LOCAL_DATABASE_URL con tu conexión PostgreSQL local.");
  }
  if (!["postgres:", "postgresql:"].includes(url.protocol) ||
      !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) ||
      url.pathname !== "/kuramanga_test" || !url.username || !url.password ||
      url.hash || [...url.searchParams].some(([key, value]) => key !== "sslmode" || value !== "disable")) {
    throw new Error("Las pruebas solo admiten PostgreSQL loopback y la base kuramanga_test, sin parámetros de red alternativos.");
  }
  if (url.hostname === "localhost") url.hostname = "127.0.0.1";
  return url.toString();
}

export function isSafeLocalAssetKey(key: string): boolean {
  return key.length > 0 && key.length <= 512 &&
    key.split("/").every((segment) => /^[a-zA-Z0-9._-]+$/.test(segment) && segment !== "." && segment !== "..") &&
    /\.(png|jpe?g|webp|gif|avif)$/i.test(key);
}
