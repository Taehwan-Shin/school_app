#!/usr/bin/env bash
# Firebase Functions 배포 — pnpm workspace 우회.
# npm 은 workspace: 프로토콜을 모른다. 배포 전 @school-app/shared 를 tarball 로 팩해서
# packages/functions/package.json 의 dep 를 file: 참조로 임시 재작성한 뒤 배포하고
# 종료 시 원복한다.
#
# 사용:  bash scripts/deploy-functions.sh [PROJECT_ID]
#        기본 PROJECT_ID = school-app-5a636

set -euo pipefail

PROJECT_ID=${1:-school-app-5a636}
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

FUNC_PKG="packages/functions/package.json"
BACKUP="packages/functions/package.json.deploy-backup"

restore() {
  if [ -f "$BACKUP" ]; then
    mv "$BACKUP" "$FUNC_PKG"
  fi
  rm -f packages/functions/school-app-shared-*.tgz
}
trap restore EXIT

echo "[1/4] @school-app/shared 빌드"
pnpm --filter @school-app/shared build

echo "[2/4] shared 를 tarball 로 팩 → packages/functions/"
rm -f packages/functions/school-app-shared-*.tgz
(cd packages/shared && pnpm pack --pack-destination ../functions >/dev/null)
TARBALL=$(basename "$(ls -t packages/functions/school-app-shared-*.tgz | head -1)")
echo "        생성: $TARBALL"

echo "[3/4] packages/functions/package.json 을 file: 참조로 임시 재작성"
cp "$FUNC_PKG" "$BACKUP"
# sed -i 는 GNU/Linux (Cloud Shell) 에서 동작. macOS 는 -i '' 필요하지만 배포는 Linux 에서.
sed -i "s|\"@school-app/shared\": \"workspace:\\*\"|\"@school-app/shared\": \"file:./$TARBALL\"|" "$FUNC_PKG"

echo "[4/4] firebase deploy --only functions --project $PROJECT_ID"
pnpm exec firebase deploy --only functions --project "$PROJECT_ID"

echo "완료. package.json 원복은 trap 이 처리."
