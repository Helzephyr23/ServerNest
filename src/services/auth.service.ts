import db from "../config/database.js";
import argon2 from "argon2";
import { env } from "../config/env.js";

interface User {
  id: number;
  username: string;
  password_hash: string;
  role: string;
  created_at: string;
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
  return { id: result.lastInsertRowid, username, role };
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
