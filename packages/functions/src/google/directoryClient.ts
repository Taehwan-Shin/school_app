import { google } from 'googleapis';
import { readFileSync } from 'node:fs';

export interface DirectoryClient {
  users: {
    list: (params?: any) => Promise<{ data: any }>;
  };
}

/**
 * 에뮬레이터 컨텍스트에서만 활성화되는 파일 기반 stub.
 * `EMULATOR_DIRECTORY_STUB_FILE` 환경변수에 JSON 경로를 두면 Directory API 호출이
 * 그 JSON 을 반환하도록 대체된다.
 *
 * **왜 필요한가**: Vitest 의 `vi.mock('googleapis')` 는 테스트 프로세스에만 적용되고,
 * `pnpm test:emu` 가 띄우는 Functions Emulator 는 별도 프로세스라 mock 이 전파되지
 * 않는다. HTTP 종단 시험이 실제 `admin.googleapis.com` 을 부르지 않도록 이 파일을
 * 통해서만 응답을 주입한다.
 *
 * **안전장치**: `FIREBASE_AUTH_EMULATOR_HOST` 또는 `FIRESTORE_EMULATOR_HOST` 가
 * 세팅된 경우에만 stub 을 활성화. 프로덕션에서 실수로 켜지는 것을 방지.
 */
function isEmulatorContext(): boolean {
  return Boolean(process.env.FIREBASE_AUTH_EMULATOR_HOST || process.env.FIRESTORE_EMULATOR_HOST);
}

function readStubResponse(): { data: any } {
  const path = process.env.EMULATOR_DIRECTORY_STUB_FILE;
  if (!path) {
    return { data: { users: [], nextPageToken: null } };
  }
  try {
    const raw = readFileSync(path, 'utf8');
    return JSON.parse(raw) as { data: any };
  } catch {
    return { data: { users: [], nextPageToken: null } };
  }
}

function getStubClient(): DirectoryClient {
  return {
    users: {
      list: async () => readStubResponse(),
    },
  };
}

export function getDirectoryClient(accessToken: string): DirectoryClient {
  if (isEmulatorContext() && process.env.EMULATOR_DIRECTORY_STUB_FILE) {
    return getStubClient();
  }
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return google.admin({ version: 'directory_v1', auth }) as unknown as DirectoryClient;
}
