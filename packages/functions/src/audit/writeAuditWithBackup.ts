import { writeAudit } from './writeAudit.js';

type AuditEntry = Parameters<typeof writeAudit>[0];

/**
 * v0.133: audit_log durable sink 인프라의 코드 side.
 *
 * `writeAudit` 는 Firestore `audit_log` 컬렉션에 append-only 로 저장하지만, 드물게
 * (network glitch · quota · outage) 실패한다. 이 helper 는 성공 후 실행 경로 (예:
 * Directory 계정 생성 뒤 감사 기록) 에서 감사 저장 실패가 성공 응답을 뒤엎지 않도록:
 *
 * 1. 최대 3회 재시도 (지수 백오프 100ms · 200ms).
 * 2. 최종 실패 시 Cloud Logging 에 severity=ERROR + 원본 audit payload 를 structured
 *    JSON 으로 남긴다. Cloud Logging 은 30일 기본 보존이지만, log routing sink 를 통해
 *    BigQuery 나 GCS 로 stream 하면 완전 durable 로 재구성 가능.
 * 3. **throw 하지 않는다** — 호출자가 성공 응답을 그대로 반환하도록.
 *
 * ### 사용 지침
 *
 * **성공 후 감사** (외부 자원 이미 변경됨) 에만 사용. 예:
 * - Directory `users.insert` / `orgunits.insert` / `classroom.patch(ownerId)` 후.
 * - 감사 유실이 재시도 시 중복 충돌 (409) 이나 자원 leak 로 이어지는 경우.
 *
 * **인증/권한/검증 실패 감사** (denied · error) 에는 사용하지 말 것. 이런 감사는 반드시
 * throw 앞에 성공해야 (fail-closed) 하므로 `writeAudit` 를 직접 호출한다. 감사 저장
 * 실패 시 request 도 error 로 응답하는 것이 accountability 규율에 맞다.
 *
 * ### 사이트별 message tag 규약
 *
 * Cloud Logging fallback 의 `message` 필드는 sink 필터로 유형 구분 가능하도록:
 * - `<callable_slug>_audit_write_failed`
 * - 예: `users_create_audit_write_failed`, `orgunits_create_audit_write_failed`,
 *   `classroom_transfer_owner_audit_write_failed`, `users_update_role_audit_write_failed`
 *
 * BigQuery/GCS sink 필터: `jsonPayload.message =~ ".+_audit_write_failed"` 로 모두 매치.
 *
 * ### 관련 문서
 * - `docs/design/AUDIT_LOG_DURABLE_SINK.md` — 인프라 설정 가이드 (bliss00 조치).
 * - `packages/functions/src/audit/writeAudit.ts` — primary Firestore write.
 */
export async function writeAuditWithBackup(
  entry: AuditEntry,
  requestId: string,
  slug: string,
): Promise<void> {
  const maxAttempts = 3;
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await writeAudit(entry);
      return;
    } catch (err) {
      lastErr = err;
      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 100 * attempt));
      }
    }
  }
  console.error(
    JSON.stringify({
      severity: 'ERROR',
      message: `${slug}_audit_write_failed`,
      request_id: requestId,
      audit_entry: entry,
      final_error: (lastErr as Error)?.message ?? String(lastErr),
    }),
  );
}
