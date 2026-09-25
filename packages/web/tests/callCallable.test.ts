import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { callCallable } from '../src/api/callCallable';

// v0.309: callCallable helper 계약 회귀. 이식 전 단계 (helper only) 이므로 실 API 호출은 mock.

// firebase auth mock
vi.mock('../src/lib/firebase', () => ({
  auth: {
    currentUser: null as unknown,
  },
}));
vi.mock('../src/lib/auth', () => ({
  getGoogleAccessTokenFromSession: () => 'mock-google-token',
}));

import { auth } from '../src/lib/firebase';

// fetch mock
const originalFetch = global.fetch;

describe('callCallable', () => {
  beforeEach(() => {
    (auth as { currentUser: unknown }).currentUser = {
      getIdToken: vi.fn(async () => 'mock-id-token'),
    };
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('not_authenticated: currentUser null 이면 즉시 throw', async () => {
    (auth as { currentUser: unknown }).currentUser = null;
    await expect(callCallable('anyFn', {})).rejects.toThrow('not_authenticated');
  });

  it('URL: DEV mode → http://127.0.0.1:5001/{projectId}/asia-northeast3/{fn} (전체 scheme/host/projectId/region/fn 검증)', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ result: { ok: true } }), { status: 200 }),
    );
    global.fetch = fetchMock;
    await callCallable('classroomStudentsList', { courseId: '123' });
    const [urlArg] = fetchMock.mock.calls[0];
    // vitest 는 DEV mode → localhost emulator URL. projectId 는 env var 미설정 시 default 'school-app-5a636'.
    expect(urlArg as string).toBe(
      'http://127.0.0.1:5001/school-app-5a636/asia-northeast3/classroomStudentsList',
    );
  });

  it('headers: 필수 key set (Authorization/X-Google-Access-Token/X-Request-Id/Content-Type) exact 매칭 · 추가 key 없음', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ result: {} }), { status: 200 }),
    );
    global.fetch = fetchMock;
    await callCallable('anyFn', {});
    const [, init] = fetchMock.mock.calls[0];
    const headers = (init as RequestInit).headers as Record<string, string>;
    // Exact key set (X-Google-Scopes 는 options.scopes 미전달 시 없음)
    const expectedKeys = ['Authorization', 'Content-Type', 'X-Google-Access-Token', 'X-Request-Id'];
    expect(Object.keys(headers).sort()).toEqual(expectedKeys.sort());
    expect(headers.Authorization).toBe('Bearer mock-id-token');
    expect(headers['X-Google-Access-Token']).toBe('mock-google-token');
    expect(headers['X-Request-Id']).toBeTypeOf('string');
    expect(headers['X-Request-Id'].length).toBeGreaterThan(0);
    expect(headers['Content-Type']).toBe('application/json');
  });

  it('scopes optional: 전달 시 X-Google-Scopes header · 미전달 시 생략', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ result: {} }), { status: 200 }),
    );
    global.fetch = fetchMock;

    // With scopes.
    await callCallable('anyFn', {}, { scopes: 'https://www.googleapis.com/auth/foo' });
    let headers = ((fetchMock.mock.calls[0][1] as RequestInit).headers ?? {}) as Record<
      string,
      string
    >;
    expect(headers['X-Google-Scopes']).toBe('https://www.googleapis.com/auth/foo');

    // Without scopes.
    fetchMock.mockClear();
    await callCallable('anyFn', {});
    headers = ((fetchMock.mock.calls[0][1] as RequestInit).headers ?? {}) as Record<string, string>;
    expect(headers['X-Google-Scopes']).toBeUndefined();
  });

  it('body: data 를 `{ data: { ...data, _googleAccessToken } }` 로 감싸 POST', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ result: {} }), { status: 200 }),
    );
    global.fetch = fetchMock;
    await callCallable('anyFn', { foo: 'bar', num: 42 });
    const bodyStr = ((fetchMock.mock.calls[0][1] as RequestInit).body ?? '{}') as string;
    const parsed = JSON.parse(bodyStr);
    expect(parsed).toEqual({
      data: {
        foo: 'bar',
        num: 42,
        _googleAccessToken: 'mock-google-token',
      },
    });
  });

  it('non-ok response: 에러 message + status property throw', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ error: { message: 'permission-denied' } }), {
        status: 403,
      }),
    );
    global.fetch = fetchMock;
    let caught: (Error & { status?: number }) | null = null;
    try {
      await callCallable('anyFn', {});
    } catch (e) {
      caught = e as Error & { status?: number };
    }
    expect(caught).not.toBeNull();
    expect(caught!.message).toBe('permission-denied');
    expect(caught!.status).toBe(403);
  });

  it('non-ok response with body.error.details: `details` property 보존 (v0.116c F77 partial 실패/rollback 정보 · classroomTransferOwnership 대칭)', async () => {
    const detailsPayload = {
      addedTeacherButPatchFailed: true,
      rollback: 'failed',
      newOwnerEmail: 'teacher@example.com',
    };
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          error: { message: 'partial_transfer_failed', details: detailsPayload },
        }),
        { status: 500 },
      ),
    );
    global.fetch = fetchMock;
    let caught: (Error & { status?: number; details?: unknown }) | null = null;
    try {
      await callCallable('classroomTransferOwnership', {});
    } catch (e) {
      caught = e as Error & { status?: number; details?: unknown };
    }
    expect(caught).not.toBeNull();
    expect(caught!.message).toBe('partial_transfer_failed');
    expect(caught!.status).toBe(500);
    expect(caught!.details).toEqual(detailsPayload);
  });

  it('non-ok response with no body: `http_${status}` fallback message', async () => {
    const fetchMock = vi.fn(async () =>
      new Response('not json', { status: 500 }),
    );
    global.fetch = fetchMock;
    let caught: (Error & { status?: number }) | null = null;
    try {
      await callCallable('anyFn', {});
    } catch (e) {
      caught = e as Error & { status?: number };
    }
    expect(caught).not.toBeNull();
    expect(caught!.message).toBe('http_500');
    expect(caught!.status).toBe(500);
  });

  it('response unwrap: body.result 우선, 없으면 body 그대로', async () => {
    // Case 1: body.result 있음
    const fetchMock1 = vi.fn(async () =>
      new Response(JSON.stringify({ result: { unwrapped: true } }), { status: 200 }),
    );
    global.fetch = fetchMock1;
    const res1 = await callCallable<unknown, { unwrapped: boolean }>('anyFn', {});
    expect(res1).toEqual({ unwrapped: true });

    // Case 2: body.result 없음
    const fetchMock2 = vi.fn(async () =>
      new Response(JSON.stringify({ direct: 'value' }), { status: 200 }),
    );
    global.fetch = fetchMock2;
    const res2 = await callCallable<unknown, { direct: string }>('anyFn', {});
    expect(res2).toEqual({ direct: 'value' });
  });
});
