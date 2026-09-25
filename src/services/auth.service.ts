import db from "../config/database.js";
import argon2 from "argon2";
import crypto from "crypto";
import { env } from "../config/env.js";

// TOTP libraries are loaded lazily on first use — otplib and qrcode are only
// needed when 2FA is actually configured, not at panel startup (LOW-002).
let totpLibs: Promise<{ otplib: typeof import("otplib"); qrcode: typeof import("qrcode") }> | null = null;
function loadTotpLibs() {
  totpLibs ??= Promise.all([import("otplib"), import("qrcode")]).then(([otplibMod, qrcodeMod]) => ({
    otplib: otplibMod,
    qrcode: qrcodeMod.default ?? qrcodeMod,
  }));
  return totpLibs;
}

const MAX_LOGIN_ATTEMPTS = 10;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;

export function isAccountLocked(userId: number): boolean {
  const row = db.prepare("SELECT locked_until FROM failed_logins WHERE user_id = ?").get(userId) as { locked_until: string | null } | undefined;
  if (!row?.locked_until) return false;
  return new Date(row.locked_until).getTime() > Date.now();
}

export function recordFailedLogin(userId: number): void {
  const row = db.prepare("SELECT attempts, locked_until FROM failed_logins WHERE user_id = ?").get(userId) as { attempts: number; locked_until: string | null } | undefined;
  if (row) {
    const newAttempts = row.attempts + 1;
    if (newAttempts >= MAX_LOGIN_ATTEMPTS) {
      const lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MS).toISOString();
      db.prepare("UPDATE failed_logins SET attempts = ?, last_attempt = datetime('now'), locked_until = ? WHERE user_id = ?").run(newAttempts, lockedUntil, userId);
    } else {
      db.prepare("UPDATE failed_logins SET attempts = ?, last_attempt = datetime('now') WHERE user_id = ?").run(newAttempts, userId);
    }
  } else {
    db.prepare("INSERT INTO failed_logins (user_id, attempts) VALUES (?, 1)").run(userId);
  }
}

export function clearFailedLogins(userId: number): void {
  db.prepare("DELETE FROM failed_logins WHERE user_id = ?").run(userId);
}

interface User {
  id: number;
  username: string;
  password_hash: string;
  role: string;
  created_at: string;
}

interface Session {
  id: number;
  user_id: number;
  jti: string;
  user_agent: string | null;
  ip: string | null;
  created_at: string;
  last_used: string;
  expired: number;
}

export function getUserByUsername(username: string): User | undefined {
  return db.prepare("SELECT * FROM users WHERE username = ?").get(username) as User | undefined;
}

export function getUserById(id: number): User | undefined {
  return db.prepare("SELECT * FROM users WHERE id = ?").get(id) as User | undefined;
}

export async function createUser(username: string, password: string, role: string = "admin") {
  const password_hash = await argon2.hash(password);
  const result = db.prepare("INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)").run(username, password_hash, role);
  return { id: Number(result.lastInsertRowid), username, role };
}

export async function verifyPassword(user: User, password: string): Promise<boolean> {
  return argon2.verify(user.password_hash, password);
}

export function isFirstRun(): boolean {
  const count = db.prepare("SELECT COUNT(*) as count FROM users").get() as { count: number };
  return count.count === 0;
}

export function listUsers() {
  return db.prepare("SELECT id, username, role, created_at FROM users ORDER BY created_at ASC").all();
}

export function updateUserRole(id: number, role: string) {
  return db.prepare("UPDATE users SET role = ? WHERE id = ?").run(role, id);
}

export async function updateUserPassword(id: number, password: string) {
  const password_hash = await argon2.hash(password);
  return db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(password_hash, id);
}

export function deleteUser(id: number) {
  return db.prepare("DELETE FROM users WHERE id = ?").run(id);
}

export function createSession(userId: number, userAgent?: string, ip?: string): string {
  const jti = crypto.randomUUID();
  db.prepare("INSERT INTO sessions (user_id, jti, user_agent, ip) VALUES (?, ?, ?, ?)").run(userId, jti, userAgent || null, ip || null);
  return jti;
}

export function getSessions(userId: number): Session[] {
  return db.prepare("SELECT * FROM sessions WHERE user_id = ? AND expired = 0 ORDER BY last_used DESC").all(userId) as Session[];
}

export function getSessionByJti(jti: string): Session | undefined {
  return db.prepare("SELECT * FROM sessions WHERE jti = ? AND expired = 0").get(jti) as Session | undefined;
}

export function revokeSession(sessionId: number): void {
  db.prepare("UPDATE sessions SET expired = 1 WHERE id = ?").run(sessionId);
}

export function revokeSessionByJti(jti: string): void {
  db.prepare("UPDATE sessions SET expired = 1 WHERE jti = ?").run(jti);
}

export function revokeAllUserSessions(userId: number, excludeJti?: string): void {
  if (excludeJti) {
    db.prepare("UPDATE sessions SET expired = 1 WHERE user_id = ? AND jti != ?").run(userId, excludeJti);
  } else {
    db.prepare("UPDATE sessions SET expired = 1 WHERE user_id = ?").run(userId);
  }
}

export function touchSession(jti: string): void {
  db.prepare("UPDATE sessions SET last_used = datetime('now') WHERE jti = ?").run(jti);
}

// ── TOTP Secret Encryption ──

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;

function deriveEncryptionKey(): Buffer {
  return crypto.createHash("sha256").update(env.JWT_SECRET).digest();
}

function encryptSecret(plaintext: string): string {
  const key = deriveEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");
  const tag = cipher.getAuthTag().toString("hex");
  return `${iv.toString("hex")}:${tag}:${encrypted}`;
}

function decryptSecret(ciphertext: string): string {
  const key = deriveEncryptionKey();
  const parts = ciphertext.split(":");
  if (parts.length !== 3) throw new Error("Invalid encrypted secret format");
  const iv = Buffer.from(parts[0], "hex");
  const tag = Buffer.from(parts[1], "hex");
  const encrypted = parts[2];
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

// ── 2FA / TOTP ──

interface UserWithTotp extends User {
  totp_secret: string | null;
  totp_enabled: number;
}

export function isTotpEnabled(userId: number): boolean {
  const user = db.prepare("SELECT totp_enabled FROM users WHERE id = ?").get(userId) as { totp_enabled: number } | undefined;
  return user?.totp_enabled === 1;
}

export async function setupTotp(userId: number): Promise<{ secret: string; uri: string; qr: string }> {
  const { otplib, qrcode } = await loadTotpLibs();
  const secret = otplib.generateSecret();
  const user = db.prepare("SELECT username FROM users WHERE id = ?").get(userId) as { username: string } | undefined;
  const uri = otplib.generateURI({ issuer: "Biryani", label: user?.username || "user", secret });
  const qr = await qrcode.toDataURL(uri);

  db.prepare("UPDATE users SET totp_secret = ? WHERE id = ?").run(encryptSecret(secret), userId);
  return { secret, uri, qr };
}

export async function verifyTotpCode(code: string, userId: number): Promise<boolean> {
  const user = db.prepare("SELECT totp_secret FROM users WHERE id = ?").get(userId) as UserWithTotp | undefined;
  if (!user?.totp_secret) return false;
  try {
    const plaintext = decryptSecret(user.totp_secret);
    const { otplib } = await loadTotpLibs();
    return otplib.verifySync({ token: code, secret: plaintext }).valid;
  } catch {
    return false;
  }
}

export function enableTotp(userId: number): void {
  db.prepare("UPDATE users SET totp_enabled = 1 WHERE id = ?").run(userId);
}

export function disableTotp(userId: number): void {
  db.prepare("UPDATE users SET totp_secret = NULL, totp_enabled = 0 WHERE id = ?").run(userId);
}

export function getUserTotpStatus(userId: number): { enabled: boolean; setup: boolean } {
  const user = db.prepare("SELECT totp_secret, totp_enabled FROM users WHERE id = ?").get(userId) as UserWithTotp | undefined;
  return {
    enabled: user?.totp_enabled === 1,
    setup: !!user?.totp_secret,
  };
}

export function resetAllUsers(): void {
  db.prepare("DELETE FROM users").run();
  db.prepare("DELETE FROM sessions").run();
  db.prepare("DELETE FROM failed_logins").run();
}
