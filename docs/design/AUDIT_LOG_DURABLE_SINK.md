# audit_log durable sink 설정 가이드

> v0.133 · school-app-5a636 프로젝트 대상.
> 이 문서는 감사 로그를 완전히 영구 보존 (durable) 하기 위한 인프라 설정 방법.
> 코드 side 는 이미 준비되어 있으며 (`writeAuditWithBackup` shared util), 이 문서는
> **사용자 (bliss00) 가 Firebase Console / gcloud 에서 해야 할 조치**만 다룹니다.

## 왜 필요한가

현재 감사 데이터 저장 경로:

1. **Primary**: Firestore `audit_log` 컬렉션 — 앱이 UI 로 조회 가능. Firestore 자체는
   기본적으로 백업/복구 가능하지만 프로젝트 삭제 등에는 노출.
2. **Fallback**: Cloud Logging (Firestore write 실패 시). `writeAuditWithBackup` 이
   structured JSON 을 남김. **기본 보존 30일**.

**한계**:
- Fallback 로그는 30 일 후 사라짐 → 감사 유실 가능.
- Firestore backup 은 별도 설정 안 하면 없음.
- 장기 조회/집계 (연간 감사 리포트 등) 는 Firestore 로 힘듦.

**해결**: Cloud Logging + Firestore 를 각각 durable sink 로 stream.

## Sink 옵션

### 옵션 A: Cloud Logging → BigQuery (권장)

**용도**: fallback 로그 (audit_write_failed) 를 BigQuery 로 stream. SQL 조회 가능.

**장점**: 30일 이후에도 조회 가능. 감사 대시보드/리포트 SQL 로 작성 가능.
**단점**: BigQuery storage/query 비용 발생 (매우 저렴, 월 수 GB 이하는 무료).

### 옵션 B: Cloud Logging → GCS (아카이브)

**용도**: 파일 아카이브. 조회 불편, 저장 저렴.

**장점**: GCS Coldline storage 는 매우 저렴. 컴플라이언스용 장기 보관.
**단점**: SQL 조회 불가 (다시 BigQuery 로 load 해야).

### 옵션 C: Firestore → BigQuery (Firebase extension)

**용도**: **Primary** audit_log 데이터를 BigQuery 로 실시간 streaming.

**장점**: 앱의 감사 데이터 전체를 SQL 로 조회 가능. Firestore 데이터 손실 시에도 남음.
**단점**: 추가 Firebase extension 설치 필요 + BigQuery cost.

**권장 조합**: 옵션 A + 옵션 C.

## 옵션 A 설정: Cloud Logging → BigQuery Sink

### 1. BigQuery 데이터셋 생성

```bash
# Cloud Shell 또는 로컬 gcloud (프로젝트 지정 필요)
gcloud auth login
gcloud config set project school-app-5a636

# 데이터셋 (asia-northeast3 == region 일치)
bq --location=asia-northeast3 mk --dataset school-app-5a636:audit_log_sink
```

또는 Firebase Console → BigQuery → 「데이터셋 만들기」:
- ID: `audit_log_sink`
- 위치: `asia-northeast3`

### 2. Cloud Logging Sink 생성

```bash
# Filter: audit_write_failed 로 끝나는 message 만 (Cloud Functions 만 stream)
gcloud logging sinks create audit-write-failed-to-bq \
  bigquery.googleapis.com/projects/school-app-5a636/datasets/audit_log_sink \
  --log-filter='resource.type="cloud_function" AND jsonPayload.message=~"_audit_write_failed$"' \
  --project=school-app-5a636
```

또는 Firebase Console → Logging → Log Router → 「+ 싱크 만들기」:
- 이름: `audit-write-failed-to-bq`
- 대상: BigQuery dataset → `audit_log_sink`
- 필터:
  ```
  resource.type="cloud_function"
  jsonPayload.message=~"_audit_write_failed$"
  ```

### 3. Service Account 권한 부여

Sink 생성 시 Google 이 자동으로 만든 service account (예: `p{PROJECT_NUMBER}-{ID}@gcp-sa-logging.iam.gserviceaccount.com`) 에게 BigQuery 에 쓸 권한이 있어야:

```bash
# sink 정보 확인
gcloud logging sinks describe audit-write-failed-to-bq

# writerIdentity 를 복사 → BigQuery Data Editor 부여
gcloud projects add-iam-policy-binding school-app-5a636 \
  --member="serviceAccount:{writerIdentity}" \
  --role="roles/bigquery.dataEditor"
```

### 4. 조회 예시

sink 활성화 후 몇 시간 뒤 (Google 이 로그 stream 하는 시간):

```sql
-- 최근 실패 목록
SELECT
  timestamp,
  jsonPayload.request_id,
  jsonPayload.audit_entry.actor,
  jsonPayload.audit_entry.action,
  jsonPayload.audit_entry.target,
  jsonPayload.audit_entry.result,
  jsonPayload.audit_entry.message,
  jsonPayload.final_error
FROM `school-app-5a636.audit_log_sink.run_googleapis_com_stderr_*`
WHERE jsonPayload.message LIKE '%_audit_write_failed'
ORDER BY timestamp DESC
LIMIT 100;

-- callable 별 fallback 빈도 (지난 30일)
SELECT
  jsonPayload.message AS slug,
  COUNT(*) AS fallback_count
FROM `school-app-5a636.audit_log_sink.run_googleapis_com_stderr_*`
WHERE _PARTITIONTIME >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY)
  AND jsonPayload.message LIKE '%_audit_write_failed'
GROUP BY slug
ORDER BY fallback_count DESC;
```

## 옵션 C 설정: Firestore → BigQuery (Firebase Extension)

### 1. Extension 설치

Firebase Console → Extensions → 「Explore extensions」 → **「Stream Collections to
BigQuery」** (by Firebase) 검색 → Install.

설정:
- Collection path: `audit_log`
- BigQuery dataset ID: `firestore_audit_log`
- BigQuery table ID: `audit_log_raw`
- Location: `asia-northeast3` (Firestore 와 동일)
- Wildcard IDs: 비워둠

이 extension 은 audit_log 컬렉션에 신규 doc 이 추가될 때마다 BigQuery table 로
자동 stream. 기존 데이터는 별도 backfill 스크립트로 (extension 문서 참고).

### 2. 조회 예시

```sql
-- 오늘 감사 액션별 정확 count (앱의 「정확 카운트 보기」와 동일)
SELECT
  data.action,
  COUNT(*) AS count
FROM `school-app-5a636.firestore_audit_log.audit_log_raw`
WHERE TIMESTAMP_MILLIS(CAST(data.at._seconds AS INT64) * 1000)
      >= TIMESTAMP_TRUNC(CURRENT_TIMESTAMP(), DAY)
GROUP BY data.action
ORDER BY count DESC;
```

## 보존 정책 권장

- **BigQuery**: 감사 데이터셋에 partition expiration 을 설정하지 않으면 무한 보존.
  용량이 신경 쓰이면 2 년 partition expiration:
  ```bash
  bq update --time_partitioning_expiration 63072000 school-app-5a636:audit_log_sink.run_googleapis_com_stderr_
  ```
- **GCS**: Coldline storage class + lifecycle 규칙으로 5 년 후 Archive/삭제.

## 삭제/롤백

Sink 를 지우려면:

```bash
gcloud logging sinks delete audit-write-failed-to-bq --project=school-app-5a636
```

Extension 은 Firebase Console → Extensions → 「Uninstall」.

BigQuery dataset 은 그대로 두고 sink 만 지우면 신규 데이터만 stream 중단, 기존
데이터는 유지.

## 보안 관점 (bliss00 확인 사항)

- **sink 대상 (BigQuery dataset, GCS bucket) 은 프로젝트 소유자만 접근 가능**하도록
  IAM 이 자동 설정됨. 지금 super_admin 이 Firestore `audit_log` 를 조회 가능한 것과
  같은 신뢰 경계.
- **감사 데이터 새로 노출 없음**. 이미 super_admin 이 조회 가능한 데이터를 durable
  destination 으로 복사만 하는 것.
- 새 IAM 권한도 추가 안 함 (log routing service account 는 Google 이 관리, 최소 권한).

## 관련 코드

- `packages/functions/src/audit/writeAuditWithBackup.ts` — helper 정의.
- `packages/functions/src/audit/writeAudit.ts` — primary Firestore write.
- 사용 사이트: `orgunitsCreate` · `usersCreate` · `classroomTransferOwnership` (성공 후 감사).

## 관련 감사 이력

- v0.116d F78 — durable sink 잔재 지적 (transferOwnership 에 fallback 도입).
- v0.121b F98 — orgunitsCreate 에 확산.
- v0.132b F106 — usersCreate 에 확산.
- v0.133 — shared util 추출 + 이 문서.
