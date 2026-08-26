import db from "../config/database.js";

export interface AuditEntry {
  id: number;
  user_id: number | null;
  username: string | null;
  action: string;
  target_type: string | null;
  target_id: number | null;
  details: string | null;
  ip: string | null;
  created_at: string;
}

export function logAudit(data: {
  user_id?: number;
  username?: string;
  action: string;
  target_type?: string;
  target_id?: number;
  details?: string;
  ip?: string;
}) {
  db.prepare(
    "INSERT INTO audit_log (user_id, username, action, target_type, target_id, details, ip) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).run(
    data.user_id || null,
    data.username || null,
    data.action,
    data.target_type || null,
    data.target_id || null,
    data.details || null,
    data.ip || null,
  );
}

export function getAuditLog(limit = 100, offset = 0): AuditEntry[] {
  return db.prepare("SELECT * FROM audit_log ORDER BY created_at DESC LIMIT ? OFFSET ?").all(limit, offset) as AuditEntry[];
}

export function getAuditLogCount(): number {
  return (db.prepare("SELECT COUNT(*) as count FROM audit_log").get() as { count: number }).count;
}
