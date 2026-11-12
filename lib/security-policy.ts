export const PUBLIC_REGISTRATION_ROLE = "READER" as const;

export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/[<>&\u2028\u2029]/g, (character) =>
    `\\u${character.charCodeAt(0).toString(16).padStart(4, "0")}`);
}

export function secureSessionCookie(environment: string, nodeEnvironment: string | undefined): boolean {
  if (environment === "local-test") return false;
  return environment === "staging" || environment === "production" || nodeEnvironment === "production";
}
