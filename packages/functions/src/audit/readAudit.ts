import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import type { Role } from '@school-app/shared';

export interface AuditLogEntryRead {
  id: string;
  actor: string;
  role: Role | 'unknown';
  action: string;
  target: string;
  request_id: string;
  result: 'ok' | 'error' | 'denied';
  at: number; // ms since epoch (Timestamp -> ms 변환)
  before?: unknown;
  after?: unknown;
  message?: string;
}

export interface ReadAuditEntriesOptions {
  limit: number; // 1..200
  before?: number; // ms since epoch, exclusive
  atMin?: number; // ms since epoch, inclusive (at >= atMin)
  atMax?: number; // ms since epoch, inclusive (at <= atMax)
  filterActor?: string; // 정확 매치
  filterTarget?: string; // 정확 매치
  filterResult?: 'ok' | 'error' | 'denied';
}

export interface ReadAuditEntriesResult {
  entries: AuditLogEntryRead[];
  nextCursor: number | null; // 마지막 항목의 at (ms), 페이지가 꽉 찼을 때만. 아니면 null.
}

export async function readAuditEntries(
  options: ReadAuditEntriesOptions,
): Promise<ReadAuditEntriesResult> {
  const db = getFirestore();
  const { limit, before, atMin, atMax, filterActor, filterTarget, filterResult } = options;

  let query: FirebaseFirestore.Query = db.collection('audit_log').orderBy('at', 'desc');
  if (before !== undefined) {
    query = query.where('at', '<', Timestamp.fromMillis(before));
  }
  if (atMin !== undefined) {
    query = query.where('at', '>=', Timestamp.fromMillis(atMin));
  }
  if (atMax !== undefined) {
    query = query.where('at', '<=', Timestamp.fromMillis(atMax));
  }
  if (filterActor) {
    query = query.where('actor', '==', filterActor);
  }
  if (filterTarget) {
    query = query.where('target', '==', filterTarget);
  }
  if (filterResult) {
    query = query.where('result', '==', filterResult);
  }
  query = query.limit(limit);

  const snap = await query.get();
  const entries: AuditLogEntryRead[] = snap.docs.map((doc) => {
    const data = doc.data();
    const at =
      data.at && typeof data.at.toMillis === 'function' ? data.at.toMillis() : Date.now();
    return {
      id: doc.id,
      actor: data.actor,
      role: data.role,
      action: data.action,
      target: data.target,
      request_id: data.request_id,
      result: data.result,
      at,
      before: data.before,
      after: data.after,
      message: data.message,
    };
  });

  const nextCursor =
    entries.length === limit ? entries[entries.length - 1].at : null;

  return { entries, nextCursor };
}
