#!/usr/bin/env node
// Firebase Functions 배포용 자립형 아티팩트 생성.
//
// 왜 필요한가:
//   packages/functions 는 pnpm 워크스페이스에서 @school-app/shared 를 `workspace:*`
//   로 참조한다. Firebase 는 packages/functions 만 업로드하고 Cloud Build 가 그 안에서
//   `npm install --production` 을 실행하는데, npm 은 `workspace:` 프로토콜을 이해 못
//   해서 EUNSUPPORTEDPROTOCOL 로 실패한다.
//
// 해결:
//   1) `pnpm deploy` (with inject-workspace-packages) 로 packages/functions/deploy/
//      에 자립형 사본을 생성. workspace 의존성은 node_modules/@school-app/shared 로
//      실제 복사된다.
//   2) 그 shared 사본을 deploy/_shared/ 로 옮기고, deploy/package.json 에서
//      workspace 별칭 문자열을 `file:./_shared` 로 재작성.
//   3) firebase.json 의 functions.source 를 packages/functions/deploy 로 지정하면
//      Cloud Build 가 그 dir 만 업로드받아 표준 npm install 로 성공한다.

import { spawnSync } from 'node:child_process';
import { rm, cp, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FUNCTIONS_ROOT = resolve(__dirname, '..');
const REPO_ROOT = resolve(FUNCTIONS_ROOT, '../..');
const DEPLOY_DIR = resolve(FUNCTIONS_ROOT, 'deploy');

function run(cmd, args, opts = {}) {
  const res = spawnSync(cmd, args, {
    cwd: opts.cwd ?? REPO_ROOT,
    stdio: 'inherit',
    shell: false,
  });
  if (res.status !== 0) {
    console.error(`\ncommand failed: ${cmd} ${args.join(' ')}`);
    process.exit(res.status ?? 1);
  }
}

async function main() {
  console.log('[prepare-deploy] 이전 deploy 디렉토리 정리...');
  if (existsSync(DEPLOY_DIR)) {
    await rm(DEPLOY_DIR, { recursive: true, force: true });
  }

  console.log('[prepare-deploy] shared + functions 빌드...');
  run('pnpm', ['--filter', '@school-app/shared', 'build']);
  run('pnpm', ['--filter', '@school-app/functions', 'build']);

  console.log('[prepare-deploy] pnpm deploy 로 자립형 아티팩트 생성...');
  run('pnpm', ['deploy', '--filter', '@school-app/functions', '--prod', 'packages/functions/deploy']);

  console.log('[prepare-deploy] shared 사본을 _shared/ 로 이동...');
  const injectedShared = resolve(DEPLOY_DIR, 'node_modules/@school-app/shared');
  const finalShared = resolve(DEPLOY_DIR, '_shared');
  if (!existsSync(injectedShared)) {
    console.error(`missing injected shared: ${injectedShared}`);
    process.exit(1);
  }
  // dereference: true 로 심볼릭 링크를 실제 파일로 복사한다.
  // pnpm 이 워크스페이스 사본을 심어놓을 때 종종 node_modules/.pnpm/... 로 심볼릭
  // 링크로 만드는데, 뒤에서 node_modules 를 통째로 지우면 링크가 dangling 이 된다.
  await cp(injectedShared, finalShared, { recursive: true, dereference: true });
  await rm(injectedShared, { recursive: true, force: true });

  console.log('[prepare-deploy] deploy/package.json 재작성 (workspace 별칭 → file:./_shared)...');
  const pkgPath = resolve(DEPLOY_DIR, 'package.json');
  const pkg = JSON.parse(await readFile(pkgPath, 'utf8'));
  // pnpm 은 버전 문자열에 peer 의존성 주석 (예: "6.6.0(firebase-admin@12.7.0)") 을
  // 붙이는데 npm 은 이걸 잘못된 semver 로 판정하므로 벗겨낸다.
  const stripPnpmPeerAnnotation = (v) =>
    typeof v === 'string' ? v.replace(/\([^)]*\)$/, '') : v;
  const cleanedDeps = {};
  for (const [name, version] of Object.entries(pkg.dependencies ?? {})) {
    cleanedDeps[name] = stripPnpmPeerAnnotation(version);
  }
  pkg.dependencies = {
    ...cleanedDeps,
    '@school-app/shared': 'file:./_shared',
  };
  // Cloud Build 는 devDependencies 를 무시하지만 배포 산출물의 크기를 줄이기 위해 제거.
  delete pkg.devDependencies;
  // pnpm 전용 필드는 npm 에게 무해하나 정리 차원에서 제거.
  delete pkg.pnpm;
  await writeFile(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');

  // pnpm 잔여물 정리: lockfile 과 pnpm-style node_modules 제거.
  // 이유:
  //   - Cloud Build 는 lockfile 종류로 패키지 매니저를 감지하므로 pnpm-lock.yaml 이
  //     있으면 pnpm 을 쓰려 하고, 그 lockfile 은 로컬 절대 경로를 담고 있어 실패.
  //   - pnpm 이 심은 node_modules 는 심볼릭 링크 구조 (.pnpm/...) 라 npm 이나
  //     firebase-tools 가 정상 해석 못 함.
  console.log('[prepare-deploy] pnpm 잔여물 (lockfile, .npmrc, node_modules) 제거...');
  for (const f of ['pnpm-lock.yaml', '.npmrc']) {
    const p = resolve(DEPLOY_DIR, f);
    if (existsSync(p)) await rm(p, { force: true });
  }
  const deployNodeModules = resolve(DEPLOY_DIR, 'node_modules');
  if (existsSync(deployNodeModules)) {
    await rm(deployNodeModules, { recursive: true, force: true });
  }

  // firebase-tools 는 배포 전 로컬에서 `require('firebase-functions')` 로 SDK
  // 위치를 찾고 dist/index.js 를 loading 해 callable 을 열거한다 (파일 상단의
  // `@school-app/shared` import 도 그때 해석). 따라서 로컬에도 정상적인 npm
  // 구조의 node_modules 가 필요. npm install 로 file:./_shared 를 정식 링크로
  // 걸어주고 다른 prod 의존성도 npm 방식으로 설치.
  //
  // Cloud Build 는 firebase.json ignore 로 node_modules 를 제외 업로드받고 자체
  // npm ci 를 수행하므로, 여기서 만드는 node_modules 는 순수 로컬 검증용.
  console.log('[prepare-deploy] deploy dir 에 npm install --omit=dev...');
  run('npm', ['install', '--omit=dev', '--no-fund', '--no-audit', '--loglevel=error'], {
    cwd: DEPLOY_DIR,
  });

  console.log('[prepare-deploy] 완료.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
