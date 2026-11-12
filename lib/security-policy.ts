export const PUBLIC_REGISTRATION_ROLE = "READER" as const;

export function roleChangeError(
  actorId: string,
  target: { id: string; role: string },
  newRole: unknown,
  adminCount: number,
  primaryAdminId = "",
): string | null {
  if (!["READER", "UPLOADER", "ADMIN"].includes(String(newRole))) return "Rol no válido.";
  if (newRole === "ADMIN") return null;
  if (primaryAdminId && target.id === primaryAdminId) return "No puedes cambiar el rol del administrador principal.";
  if (target.role !== "ADMIN") return null;
  if (target.id === actorId) return "No puedes quitarte tu propio rol de administrador.";
  if (adminCount <= 1) return "No puedes quitar el rol al último administrador.";
  if (!primaryAdminId) return "Configura PRIMARY_ADMIN_USER_ID antes de retirar permisos a un administrador.";
  return null;
}

export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/[<>&\u2028\u2029]/g, (character) =>
    `\\u${character.charCodeAt(0).toString(16).padStart(4, "0")}`);
}

export function secureSessionCookie(environment: string, nodeEnvironment: string | undefined): boolean {
  if (environment === "local-test") return false;
  return environment === "staging" || environment === "production" || nodeEnvironment === "production";
}
