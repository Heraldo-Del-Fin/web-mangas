import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export function hashPassword(password: string, fixedSalt?: string): string {
  const salt = fixedSalt ?? randomBytes(16).toString("hex");
  const derived = createHmac("sha256", salt).update(password).digest("hex");
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, key] = storedHash.split(":");
  if (!salt || !key) return false;
  const keyBuffer = Buffer.from(key, "hex");
  const derivedHex = createHmac("sha256", salt).update(password).digest("hex");
  const derivedBuffer = Buffer.from(derivedHex, "hex");
  if (keyBuffer.length !== derivedBuffer.length) return false;
  return timingSafeEqual(keyBuffer, derivedBuffer);
}

export function generateSessionToken(): string {
  return randomBytes(32).toString("hex");
}
