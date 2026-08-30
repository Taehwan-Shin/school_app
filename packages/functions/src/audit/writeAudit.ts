import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import type { Role } from '@school-app/shared';

export interface AuditEntry {
  actor: string;             // 이메일
  role: 'super_admin' | 'admin' | 'teacher';
  action: string;            // Capability 문자열 (예: 'users.read')
  target: string;            // 대상 자원 식별자
  request_id: string;
  result: 'ok' | 'error' | 'denied';
  before?: unknown;
  after?: unknown;
  message?: string;
}

export async function writeAudit(entry: AuditEntry): Promise<void> {
  const db = getFirestore();
  const docData: Record<string, unknown> = {
    actor: entry.actor,
    role: entry.role,
    action: entry.action,
    target: entry.target,
    request_id: entry.request_id,
    result: entry.result,
    at: FieldValue.serverTimestamp(),
  };

  if (entry.before !== undefined) {
    docData.before = entry.before;
  }
  if (entry.after !== undefined) {
    docData.after = entry.after;
  }
  if (entry.message !== undefined) {
    docData.message = entry.message;
  }

  await db.collection('audit_log').add(docData);
}
