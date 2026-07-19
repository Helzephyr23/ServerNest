import db from "../config/database.js";
import argon2 from "argon2";
import crypto from "crypto";
import { env } from "../config/env.js";

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
