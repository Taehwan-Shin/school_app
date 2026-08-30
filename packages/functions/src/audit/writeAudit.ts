import { getFirestore, FieldValue } from 'firebase-admin/firestore';

export interface AuditEntry {
  actor: string;             // 이메일 또는 'unknown'
  /**
   * 사용자 role. 세 정상 값 외에 `'unknown'` 을 허용한다.
   * 인증 실패·role claim 부재 상태의 denied 감사 로그에서 임의 role 로 위조하지
   * 않고 실 상태를 그대로 남기기 위함.
   */
  role: 'super_admin' | 'admin' | 'teacher' | 'unknown';
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
