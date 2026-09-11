import { getFirestore, Timestamp, FieldPath } from 'firebase-admin/firestore';
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

// v0.118b F82 / v0.118c F86: 같은 timestamp 이벤트가 페이지 경계에서 유실되지
// 않도록 (Timestamp, docId) compound cursor 로 안정화. Firestore Timestamp 는
// microsecond (nanoseconds/1000) 정밀도를 가지므로 ms 로 truncate 하면 같은 ms
// 안 서로 다른 timestamp 도 동률처럼 취급되어 여전히 이벤트를 건너뛸 수 있다.
// full precision 보존을 위해 seconds/nanoseconds 를 그대로 전달한다.
export interface ReadAuditCursor {
  seconds: number;
  nanoseconds: number;
  id: string;
}

export interface ReadAuditEntriesOptions {
  limit: number; // 1..200
  before?: ReadAuditCursor; // v0.118b F82: compound cursor.
  atMin?: number; // ms since epoch, inclusive (at >= atMin)
  atMax?: number; // ms since epoch, inclusive (at <= atMax)
  filterActor?: string; // 정확 매치
  filterTarget?: string; // 정확 매치
  filterResult?: 'ok' | 'error' | 'denied';
  filterAction?: string; // 정확 매치 (예: 'users.update_role') — v0.101 단일. v0.104 이후 filterActions 우선.
  filterActions?: string[]; // v0.104: 다중 액션 (Firestore `in` 최대 30).
}

export interface ReadAuditEntriesResult {
  entries: AuditLogEntryRead[];
  nextCursor: ReadAuditCursor | null;
}

export async function readAuditEntries(
  options: ReadAuditEntriesOptions,
): Promise<ReadAuditEntriesResult> {
  const db = getFirestore();
  const {
    limit,
    before,
    atMin,
    atMax,
    filterActor,
    filterTarget,
    filterResult,
    filterAction,
    filterActions,
  } = options;

  // v0.118b F82: orderBy(at DESC, __name__ DESC) 로 tie-breaker 확보. 기존 audit_log
  // 복합 인덱스는 [<filter>, at DESC] 로 정의됐지만 Firestore 는 모든 composite index
  // 에 __name__ 을 암묵적으로 포함하므로 별도 index 추가 없이 orderBy 확장 가능.
  let query: FirebaseFirestore.Query = db
    .collection('audit_log')
    .orderBy('at', 'desc')
    .orderBy(FieldPath.documentId(), 'desc');
  if (before !== undefined) {
    // v0.118c F86: cursor 를 full precision (seconds/nanoseconds) 로 복원.
    // Timestamp.fromMillis 는 ms 정밀도만 유지하므로 sub-ms 이벤트를 건너뛴다.
    const beforeTs = new Timestamp(before.seconds, before.nanoseconds);
    query = query.startAfter(beforeTs, before.id);
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
  // v0.104: filterActions (다중) 우선, 없으면 filterAction (단일) 사용.
  // 다중 배열 입력이 1개면 == 로 축약 (Firestore `in` 대신 == 로 index 재사용).
  // v0.104b F39: 계약 — 호출자 (callable/audit/list.ts) 가 이미 dedup + 30 개 초과 fail-closed
  // 했다는 것을 신뢰. 내부에서 조용히 slice 하지 않는다. 초과 배열이 오면 Firestore in-query
  // 가 자연스럽게 실패해 콜스택 상위로 전파 (dead-code path).
  if (filterActions && filterActions.length > 0) {
    if (filterActions.length === 1) {
      query = query.where('action', '==', filterActions[0]);
    } else {
      query = query.where('action', 'in', filterActions);
    }
  } else if (filterAction) {
    query = query.where('action', '==', filterAction);
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

  // v0.118c F86: 페이지가 꽉 찼을 때만 마지막 doc 의 Timestamp 를 full precision
  // 으로 뽑아 다음 페이지 startAfter 를 정확히 보존. entries.at (ms) 는 UI 표시용
  // 이라 microsecond 손실이 있어 cursor 재구성에 쓸 수 없음.
  let nextCursor: ReadAuditCursor | null = null;
  if (entries.length === limit) {
    const lastDoc = snap.docs[snap.docs.length - 1];
    const lastAt = lastDoc.data().at;
    if (lastAt && typeof lastAt.toMillis === 'function') {
      const ts = lastAt as Timestamp;
      nextCursor = { seconds: ts.seconds, nanoseconds: ts.nanoseconds, id: lastDoc.id };
    }
  }

  return { entries, nextCursor };
}

export interface CountAuditEntriesOptions {
  atMin?: number;
  atMax?: number;
  filterActor?: string;
  filterTarget?: string;
  filterResult?: 'ok' | 'error' | 'denied';
  // v0.126: 정확 action-별 count aggregation 을 위한 확장. v0.101b `(action,
  // at DESC)` 복합 인덱스를 그대로 재사용.
  filterAction?: string;
}

export async function countAuditEntries(options: CountAuditEntriesOptions): Promise<number> {
  const db = getFirestore();
  const { atMin, atMax, filterActor, filterTarget, filterResult, filterAction } = options;

  let query: FirebaseFirestore.Query = db.collection('audit_log');
  if (atMin !== undefined) query = query.where('at', '>=', Timestamp.fromMillis(atMin));
  if (atMax !== undefined) query = query.where('at', '<=', Timestamp.fromMillis(atMax));
  if (filterActor) query = query.where('actor', '==', filterActor);
  if (filterTarget) query = query.where('target', '==', filterTarget);
  if (filterResult) query = query.where('result', '==', filterResult);
  if (filterAction) query = query.where('action', '==', filterAction);

  const snap = await query.count().get();
  return snap.data().count;
}

