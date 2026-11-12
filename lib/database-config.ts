export function requireDatabaseUrl(value: string): string {
  try {
    const url = new URL(value);
    if (!["postgres:", "postgresql:"].includes(url.protocol) || !url.hostname || !url.username || !url.password) {
      throw new Error();
    }
  } catch {
    // Never include the input: it can contain a database password.
    throw new Error("DATABASE_URL debe configurarse mediante un secreto con una conexión PostgreSQL válida.");
  }
  return value;
}
