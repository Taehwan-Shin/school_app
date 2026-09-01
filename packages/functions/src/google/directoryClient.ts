import { google } from 'googleapis';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export interface DirectoryClient {
  users: {
    list: (params?: any) => Promise<{ data: any }>;
    insert: (params: { requestBody: any }) => Promise<{ data: any }>;
    delete: (params: { userKey: string }) => Promise<{ data: any }>;
    get: (params: { userKey: string }) => Promise<{ data: any }>;
    patch: (params: { userKey: string; requestBody: any }) => Promise<{ data: any }>;
  };
  groups: {
    list: (params?: any) => Promise<{ data: any }>;
    insert: (params: { requestBody: any }) => Promise<{ data: any }>;
    patch: (params: { groupKey: string; requestBody: any }) => Promise<{ data: any }>;
    delete: (params: { groupKey: string }) => Promise<{ data: any }>;
    get: (params: { groupKey: string }) => Promise<{ data: any }>;
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
  const candidates = [
    path,
    resolve(process.cwd(), path),
    resolve(process.cwd(), '..', path),
  ];
  for (const candidate of candidates) {
    try {
      const raw = readFileSync(candidate, 'utf8');
      return JSON.parse(raw) as { data: any };
    } catch {
      // try next candidate
    }
  }
  return { data: { users: [], nextPageToken: null } };
}

function getStubClient(): DirectoryClient {
  return {
    users: {
      list: async () => readStubResponse(),
      insert: async (params: { requestBody: any }) => {
        const stub = readStubResponse();
        if (stub.data && stub.data.insert) {
          return { data: stub.data.insert };
        }
        return {
          data: {
            id: 'stub-uid-' + Date.now(),
            primaryEmail: params?.requestBody?.primaryEmail,
            name: params?.requestBody?.name,
            orgUnitPath: params?.requestBody?.orgUnitPath,
            isAdmin: false,
            suspended: false,
          },
        };
      },
      delete: async () => {
        const stub = readStubResponse();
        if (stub.data && stub.data.delete) {
          return { data: stub.data.delete };
        }
        return { data: {} };
      },
      get: async (params: { userKey: string }) => {
        const stub = readStubResponse();
        if (stub.data && stub.data.get) {
          return { data: stub.data.get };
        }
        if (stub.data && Array.isArray(stub.data.users)) {
          const found = stub.data.users.find(
            (u: any) => u.primaryEmail === params?.userKey || u.id === params?.userKey,
          );
          if (found) {
            return { data: found };
          }
        }
        return {
          data: {
            primaryEmail: params?.userKey,
            isAdmin: false,
            suspended: false,
          },
        };
      },
      patch: async (params: { userKey: string; requestBody: any }) => {
        const stub = readStubResponse();
        if (stub.data && stub.data.patch) {
          return { data: stub.data.patch };
        }
        return {
          data: {
            primaryEmail: params?.userKey,
            ...params?.requestBody,
          },
        };
      },
    },
    groups: {
      list: async () => {
        const stub = readStubResponse();
        if (stub.data && stub.data.groups) {
          return { data: stub.data };
        }
        return { data: { groups: [], nextPageToken: null } };
      },
      insert: async (params: { requestBody: any }) => {
        const stub = readStubResponse();
        if (stub.data && stub.data.groupInsert) {
          return { data: stub.data.groupInsert };
        }
        return {
          data: {
            id: 'stub-group-' + Date.now(),
            email: params?.requestBody?.email,
            name: params?.requestBody?.name,
            description: params?.requestBody?.description ?? '',
            directMembersCount: '0',
          },
        };
      },
      patch: async (params: { groupKey: string; requestBody: any }) => {
        const stub = readStubResponse();
        if (stub.data && stub.data.groupPatch) {
          return { data: stub.data.groupPatch };
        }
        return {
          data: {
            email: params?.groupKey,
            groupKey: params?.groupKey,
            ...params?.requestBody,
          },
        };
      },
      delete: async () => {
        const stub = readStubResponse();
        if (stub.data && stub.data.groupDelete) {
          return { data: stub.data.groupDelete };
        }
        return { data: {} };
      },
      get: async (params: { groupKey: string }) => {
        const stub = readStubResponse();
        if (stub.data && stub.data.groupGet) {
          return { data: stub.data.groupGet };
        }
        if (stub.data && Array.isArray(stub.data.groups)) {
          const found = stub.data.groups.find(
            (g: any) => g.email === params?.groupKey || g.id === params?.groupKey,
          );
          if (found) {
            return { data: found };
          }
        }
        return {
          data: {
            id: 'stub-group-' + Date.now(),
            email: params?.groupKey,
            name: 'Stub Group',
            description: '',
            directMembersCount: '0',
          },
        };
      },
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
