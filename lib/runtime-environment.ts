import { getCloudflareContext } from "@opennextjs/cloudflare";

export function runtimeVariable(name: string): string {
  try {
    const value = (getCloudflareContext().env as Record<string, unknown>)[name];
    if (typeof value === "string") return value;
  } catch {
    // Next build / local Node process has no Worker request context.
  }
  return process.env[name] ?? "";
}

export function isStaging(): boolean {
  return runtimeVariable("APP_ENV") === "staging";
}

export function isLocalTest(): boolean {
  return runtimeVariable("APP_ENV") === "local-test";
}

export function isTestEnvironment(): boolean {
  return isStaging() || isLocalTest();
}

export function isProductionRuntime(): boolean {
  return !isTestEnvironment() && process.env.NEXT_PHASE !== "phase-production-build" &&
    (runtimeVariable("APP_ENV") === "production" || process.env.NODE_ENV === "production");
}

export function validateStagingDatabase(connectionString: string): string {
  if (!isStaging()) return connectionString;
  const expectedHost = runtimeVariable("STAGING_DATABASE_HOST");
  const parsed = new URL(connectionString);
  if (!expectedHost || parsed.hostname !== expectedHost ||
      !["postgres:", "postgresql:"].includes(parsed.protocol) ||
      parsed.hostname.replace("-pooler.", ".") ===
        "ep-soft-meadow-aojjnt3c.c-2.ap-southeast-1.aws.neon.tech") {
    throw new Error("Staging requiere una conexión explícita a su base Neon aislada.");
  }
  return connectionString;
}
