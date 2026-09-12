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

**권장 조합**: 옵션 A + (Firestore scheduled export / Dataflow). 옵션 C 는 2027-03-31
확장 종료 예정이라 새 설치보다 대체 방안 우선 (§옵션 C 세부 참조).

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

**중요 (F111)**: 이 프로젝트는 `firebase-functions/v2` (2세대) 를 사용합니다.
Gen2 함수의 stderr 는 Cloud Run 인프라 위에서 실행되므로 로그 `resource.type` 이
`cloud_run_revision` 입니다 (Gen1 의 `cloud_function` 아님). 참고:
https://cloud.google.com/run/docs/logging

**중요 (F112)**: `--use-partitioned-tables` 플래그를 반드시 지정합니다. 없으면 date-
sharded 테이블 (`table_YYYYMMDD` 여러 개) 로 만들어져 `_PARTITIONTIME` 쿼리가 실패
하고 `_TABLE_SUFFIX` 를 써야 합니다. 파티션 테이블 하나로 통일하면 조회/보존 정책
이 단순해집니다. 참고: https://cloud.google.com/logging/docs/export/bigquery

```bash
# Gen2 함수 (Cloud Run) stderr 만 · audit_write_failed 로 끝나는 message 만 stream
gcloud logging sinks create audit-write-failed-to-bq \
  bigquery.googleapis.com/projects/school-app-5a636/datasets/audit_log_sink \
  --log-filter='resource.type="cloud_run_revision" AND severity>=ERROR AND jsonPayload.message=~"_audit_write_failed$"' \
  --use-partitioned-tables \
  --project=school-app-5a636
```

특정 함수만 골라 stream 하고 싶다면 (선택):
```
resource.type="cloud_run_revision"
resource.labels.service_name=~"^(usersCreate|orgunitsCreate|classroomTransferOwnership)$"
jsonPayload.message=~"_audit_write_failed$"
```

또는 Firebase Console → Logging → Log Router → 「+ 싱크 만들기」:
- 이름: `audit-write-failed-to-bq`
- 대상: BigQuery dataset → `audit_log_sink`
- 「테이블 파티셔닝 사용」 (Use partitioned tables) 옵션 **체크**.
- 필터 (위와 동일).

### 3. Service Account 권한 부여 (dataset-scoped write) + 기본 ACL 정리

Sink 생성 시 Google Cloud 가 자동으로 `writerIdentity` service account 를 만듭니다.
이 SA 에게 **destination dataset 에만** 쓸 권한 (BigQuery Data Editor) 을 부여합니다.
프로젝트 전체가 아닌 dataset 단위로 최소권한 원칙을 지킵니다. 참고:
https://cloud.google.com/bigquery/docs/access-control-basic-roles

또한 새로 만든 BigQuery dataset 은 **기본으로 project-level basic role 이 상속** 됩니다:
- `projectOwners` → OWNER, `projectEditors` → WRITER, `projectViewers` → READER.

프로젝트에 owner 외 다른 사용자가 있다면 이 기본 ACL 로 read/write 가 넓어질 수
있으므로 sink dataset 은 기본 ACL 을 제거하고 명시 IAM 만 남깁니다.

**중요 (F117)**: `bq add-iam-policy-binding` 은 dataset 리소스를 지원하지 않으므로
(https://cloud.google.com/bigquery/docs/reference/bq-cli-reference#bq_add-iam-policy-binding),
dataset access 는 반드시 `bq show` → JSON `access` 편집 → `bq update --source` 흐름
으로 처리합니다 (https://cloud.google.com/bigquery/docs/control-access-to-resources-iam).
아래 한 절차로 (a) writer 명시 부여 + (b) bliss00 owner 명시 부여 + (c) project-level
basic role specialGroup 제거를 모두 처리합니다.

```bash
# 1) sink 의 writerIdentity 확인 (writer 는 `serviceAccount:...` 접두어가 붙어
#    있으므로 email 부분만 추출해서 ACL 에 넣는다).
WRITER_RAW=$(gcloud logging sinks describe audit-write-failed-to-bq \
  --project=school-app-5a636 \
  --format='value(writerIdentity)')
WRITER_EMAIL="${WRITER_RAW#serviceAccount:}"
echo "$WRITER_EMAIL"
# 예: service-{PROJECT_NUMBER}@gcp-sa-logging.iam.gserviceaccount.com

# 2) 현재 dataset ACL 을 JSON 으로 dump.
bq show --format=prettyjson school-app-5a636:audit_log_sink > audit_log_sink.acl.json

# 3) audit_log_sink.acl.json 을 편집:
#    - `access` 배열에서 아래 세 항목을 **제거** (project 상속 ACL):
#        { "role": "OWNER",  "specialGroup": "projectOwners"  }
#        { "role": "WRITER", "specialGroup": "projectWriters" }
#        { "role": "READER", "specialGroup": "projectViewers" }
#    - `access` 배열에 아래 두 항목을 **추가**:
#        { "role": "OWNER",  "userByEmail": "bliss00@cam.hs.kr" }
#        { "role": "WRITER", "userByEmail": "${WRITER_EMAIL}" }
#
#    수동 편집 대신 jq 로 한 번에:
jq --arg writer "$WRITER_EMAIL" --arg owner "bliss00@cam.hs.kr" '
  .access |= (map(select(
    .specialGroup != "projectOwners"
    and .specialGroup != "projectWriters"
    and .specialGroup != "projectViewers"
  )) + [
    { "role": "OWNER",  "userByEmail": $owner },
    { "role": "WRITER", "userByEmail": $writer }
  ])
' audit_log_sink.acl.json > audit_log_sink.acl.updated.json

# 4) 갱신 적용.
bq update --source audit_log_sink.acl.updated.json school-app-5a636:audit_log_sink

# 5) 검증: dataset 접근자 목록.
bq show --format=prettyjson school-app-5a636:audit_log_sink | jq '.access'
# 예상:
# [
#   { "role": "OWNER",  "userByEmail": "bliss00@cam.hs.kr" },
#   { "role": "WRITER", "userByEmail": "service-...@gcp-sa-logging.iam.gserviceaccount.com" }
# ]
```

**열람자 추가**: 동일한 JSON 편집 절차 (§3) 로 `access` 배열에 아래 항목 추가 후
`bq update --source` 재적용:
```json
{ "role": "READER", "userByEmail": "someone@cam.hs.kr" }
```

### 4. Smoke 확인

Sink 활성화 후 몇 분 뒤 의도적으로 fallback 을 발동해 end-to-end 를 확인 (선택):

```bash
# audit_log 컬렉션 write 를 잠깐 차단하는 방법이 없으니, 배포 후 실제 write 실패
# 로그가 나올 때까지 대기. 확인은 Logs Explorer 에서:
gcloud logging read \
  'resource.type="cloud_run_revision" AND jsonPayload.message=~"_audit_write_failed$"' \
  --project=school-app-5a636 \
  --limit=10 \
  --format=json
```

몇 분 뒤 BigQuery 에 파티션 테이블 (`run_googleapis_com_stderr`) 이 자동 생성됩니다.

### 5. 조회 예시

파티션 테이블이므로 wildcard/suffix 없이 그대로 조회:

```sql
-- 최근 실패 목록 (지난 7일)
SELECT
  timestamp,
  jsonPayload.request_id,
  jsonPayload.audit_entry.actor,
  jsonPayload.audit_entry.action,
  jsonPayload.audit_entry.target,
  jsonPayload.audit_entry.result,
  jsonPayload.audit_entry.message,
  jsonPayload.final_error
FROM `school-app-5a636.audit_log_sink.run_googleapis_com_stderr`
WHERE _PARTITIONTIME >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 7 DAY)
  AND jsonPayload.message LIKE '%_audit_write_failed'
ORDER BY timestamp DESC
LIMIT 100;

-- callable 별 fallback 빈도 (지난 30일)
SELECT
  jsonPayload.message AS slug,
  COUNT(*) AS fallback_count
FROM `school-app-5a636.audit_log_sink.run_googleapis_com_stderr`
WHERE _PARTITIONTIME >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY)
  AND jsonPayload.message LIKE '%_audit_write_failed'
GROUP BY slug
ORDER BY fallback_count DESC;
```

## 옵션 C 설정: Firestore → BigQuery (Firebase Extension)

**주의 (F113)**: Firebase 의 `firestore-bigquery-export` 확장은 2027-03-31 종료
예정입니다 (https://extensions.dev/extensions/firebase/firestore-bigquery-export).
새로 설치하기보다는 대체 방안을 우선 고려하고, 설치할 경우 종료 일정에 맞춘
migration 계획도 함께.

**대체 방안** (권장 순서):
1. **Cloud Firestore scheduled export → BigQuery load** (gcloud/scheduler 기반).
   Firestore data 를 GCS 로 매일 export 하고 BigQuery 에 load. 관리 시간이 조금
   들지만 벤더 종료 리스크 없음.
2. **Dataflow** (Firestore → BigQuery streaming pipeline). 무거운 세팅.
3. **확장 사용** (아래) — 종료 일정 인지 하에 단기 사용.

### 1. Extension 설치 (단기 사용용)

Firebase Console → Extensions → 「Explore extensions」 → **「Stream Collections to
BigQuery」** (by Firebase) 검색 → Install.

설정:
- Collection path: `audit_log`
- BigQuery dataset ID: `firestore_audit_log`
- BigQuery table ID prefix: `audit_log` (extension 이 `_raw_changelog` 접미사 자동
  부착 → 실 테이블명 `audit_log_raw_changelog`).
- Location: `asia-northeast3` (Firestore 와 동일).
- Wildcard IDs: 비워둠.

이 extension 은 audit_log 컬렉션에 신규 doc 이 추가될 때마다 BigQuery table 로
자동 stream. 기존 데이터는 별도 backfill 스크립트로 (extension 문서 참고).

### 2. 조회 예시

`_raw_changelog` 테이블의 `data` 컬럼은 **STRING** (JSON 문자열) 이므로
`JSON_EXTRACT_SCALAR` / `JSON_VALUE` / `PARSE_JSON` 으로 파싱:

```sql
-- 오늘 감사 액션별 정확 count (앱의 「정확 카운트 보기」와 동일)
SELECT
  JSON_VALUE(data, '$.action') AS action,
  COUNT(*) AS count
FROM `school-app-5a636.firestore_audit_log.audit_log_raw_changelog`
WHERE JSON_VALUE(data, '$.at._seconds') IS NOT NULL
  AND TIMESTAMP_SECONDS(CAST(JSON_VALUE(data, '$.at._seconds') AS INT64))
      >= TIMESTAMP_TRUNC(CURRENT_TIMESTAMP(), DAY)
  AND operation = 'CREATE'
GROUP BY action
ORDER BY count DESC;

-- 최근 24 시간 감사 이벤트 (특정 actor 필터 예)
SELECT
  timestamp,
  JSON_VALUE(data, '$.actor') AS actor,
  JSON_VALUE(data, '$.action') AS action,
  JSON_VALUE(data, '$.target') AS target,
  JSON_VALUE(data, '$.result') AS result
FROM `school-app-5a636.firestore_audit_log.audit_log_raw_changelog`
WHERE timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 24 HOUR)
  AND operation = 'CREATE'
  AND JSON_VALUE(data, '$.actor') = 'super@cam.hs.kr'
ORDER BY timestamp DESC;
```

## 보존 정책 권장

- **BigQuery**: 감사 데이터셋에 partition expiration 을 설정하지 않으면 무한 보존.
  용량이 신경 쓰이면 2 년 partition expiration (partitioned 테이블 대상, 이름 뒤
  underscore 없음):
  ```bash
  bq update --time_partitioning_expiration 63072000 \
    school-app-5a636:audit_log_sink.run_googleapis_com_stderr
  ```
  또는 dataset 기본 파티션 만료:
  ```bash
  bq update --default_partition_expiration 63072000 school-app-5a636:audit_log_sink
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

Sink 는 별도의 GCP IAM 경계를 만듭니다. 앱의 super_admin 경계와는 **다르므로**
아래 항목을 명시적으로 관리해야 합니다. 참고: https://cloud.google.com/logging/docs/export/configure_export_v2

### 새로 부여되는 권한 (destination write, dataset-scoped)
- Sink 생성 시 Google 이 자동으로 `writerIdentity` service account 를 만듭니다.
- §3 에서 이 SA 에 대해 **dataset (`audit_log_sink`) 만 scope 한** `bigquery.dataEditor`
  를 부여합니다 (project-wide 아님). 이 SA 는 Google 이 관리하며 감사 데이터를
  이 dataset 에만 쓸 수 있고 우리 Firestore/앱에는 접근하지 않습니다.

### Destination 읽기 권한 (읽는 사람은 별도) — 기본 ACL 제거 필수
- BigQuery dataset 은 **생성 시 기본으로 프로젝트 level basic role 을 상속**합니다:
  `projectOwners` → OWNER, `projectEditors` → WRITER, `projectViewers` → READER.
  참고: https://cloud.google.com/bigquery/docs/access-control-basic-roles
- 프로젝트에 owner 외 사용자가 있으면 이 기본 ACL 로 감사 데이터가 넓게 노출될
  수 있으므로 §3 절차에서 이 기본 ACL 을 제거하고 명시 IAM (bliss00 owner +
  writerIdentity 만) 만 남깁니다.
- 다른 조직 구성원이 sink 데이터를 봐야 하면 §3 의 JSON 편집 절차로 `access`
  배열에 `{ "role": "READER", "userByEmail": "..." }` 를 추가한 뒤 `bq update
  --source` 재적용 (`bq add-iam-policy-binding` 은 dataset 미지원).
- 앱의 super_admin role 부여와는 자동 연동되지 않습니다 — 두 경계가 별개.

### PII 보존/삭제
- 감사 데이터에는 **actor 이메일 · target 자원 식별자** 등의 PII 가 포함됩니다.
  BigQuery destination 은 sink 삭제 이후에도 데이터가 남습니다 (수동 삭제 필요).
- 보존 정책 (§보존 정책 권장) 을 설정하지 않으면 **무한 보존**. 학교의 개인정보
  파기 정책에 맞춰 partition expiration 을 설정하세요 (예: 2 년).
- 사용자의 삭제 요구 (예: 퇴학생 개인정보 삭제) 는 destination BigQuery 에서
  **개별 DML 로 삭제해야** 합니다. Firestore audit_log 삭제만으로는 sink 데이터가
  지워지지 않습니다.

### 확인 요약
- **감사 데이터 자체는 이미 super_admin 이 앱에서 조회 가능하므로 sink 는 노출
  범위를 (자체적으로는) 확대하지 않음.**
- 다만 **GCP IAM 경계는 앱 super_admin 경계와 별도**이므로 destination reader 를
  꼼꼼히 관리하고, PII 보존/삭제 정책을 명시적으로 수립해야 함.

## 관련 코드

- `packages/functions/src/audit/writeAuditWithBackup.ts` — helper 정의.
- `packages/functions/src/audit/writeAudit.ts` — primary Firestore write.
- 사용 사이트: `orgunitsCreate` · `usersCreate` · `classroomTransferOwnership` (성공 후 감사).

## 관련 감사 이력

- v0.116d F78 — durable sink 잔재 지적 (transferOwnership 에 fallback 도입).
- v0.121b F98 — orgunitsCreate 에 확산.
- v0.132b F106 — usersCreate 에 확산.
- v0.133 — shared util 추출 + 이 문서.
