import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  preloadRoute,
  ROUTE_PRELOAD_MAP,
  _resetPreloadedForTests,
} from '../src/lib/routePreload';

// v0.307 R1: routePreload 계약 강제 회귀 방어.
// - ROUTE_PRELOAD_MAP 은 App.tsx lazy() 경로와 exact set 대칭 (누락/오탈자 방어)
// - preloadRoute: import 함수 실제 호출 (spy 검증) · idempotent (1회만) · unknown no-op · reject 시 재시도 가능

const EXPECTED_ROUTE_PATHS: readonly string[] = [
  '/super_admin',
  '/super_admin/audit',
  '/super_admin/capabilities',
  '/super_admin/chat',
  '/super_admin/classrooms',
  '/admin',
  '/admin/chat',
  '/admin/classrooms',
  '/admin/groups',
  '/teacher',
];

describe('routePreload', () => {
  const originalMap: Record<string, () => Promise<unknown>> = {};

  beforeEach(() => {
    _resetPreloadedForTests();
    // Restore original map after each test (테스트에서 mock 으로 교체할 수 있게).
    for (const k of Object.keys(originalMap)) {
      ROUTE_PRELOAD_MAP[k] = originalMap[k];
      delete originalMap[k];
    }
  });

  it('ROUTE_PRELOAD_MAP 은 10 route path 를 exact set 으로 포함 (App.tsx lazy 대칭)', () => {
    const actualKeys = Object.keys(ROUTE_PRELOAD_MAP).sort();
    const expectedKeys = [...EXPECTED_ROUTE_PATHS].sort();
    expect(actualKeys).toEqual(expectedKeys);
    // 각 값은 실제로 함수 (dynamic import).
    for (const key of expectedKeys) {
      expect(typeof ROUTE_PRELOAD_MAP[key]).toBe('function');
    }
  });

  it('preloadRoute(known path): map 의 import 함수를 정확히 1회 호출', () => {
    const spy = vi.fn(() => Promise.resolve({}));
    originalMap['/admin'] = ROUTE_PRELOAD_MAP['/admin'];
    ROUTE_PRELOAD_MAP['/admin'] = spy;
    preloadRoute('/admin');
    expect(spy).toHaveBeenCalledOnce();
  });

  it('preloadRoute(idempotent): 같은 path 를 여러 번 호출해도 import 는 1회만', () => {
    const spy = vi.fn(() => Promise.resolve({}));
    originalMap['/admin'] = ROUTE_PRELOAD_MAP['/admin'];
    ROUTE_PRELOAD_MAP['/admin'] = spy;
    preloadRoute('/admin');
    preloadRoute('/admin');
    preloadRoute('/admin');
    expect(spy).toHaveBeenCalledOnce();
  });

  it('preloadRoute(unknown path): map 조회 실패 → 아무 함수도 호출 안 함', () => {
    // 실 map 의 알려진 path 들이 호출되지 않았는지 확인 하기 위해 하나에 spy 부여.
    const spy = vi.fn(() => Promise.resolve({}));
    originalMap['/admin'] = ROUTE_PRELOAD_MAP['/admin'];
    ROUTE_PRELOAD_MAP['/admin'] = spy;
    preloadRoute('/nonexistent');
    preloadRoute('');
    expect(spy).not.toHaveBeenCalled();
  });

  it('preloadRoute(fetch reject): preloaded 집합에서 제거되어 재시도 가능 (2번 호출됨)', async () => {
    let attempt = 0;
    const spy = vi.fn(() => {
      attempt += 1;
      return attempt === 1
        ? Promise.reject(new Error('network fail'))
        : Promise.resolve({});
    });
    originalMap['/admin'] = ROUTE_PRELOAD_MAP['/admin'];
    ROUTE_PRELOAD_MAP['/admin'] = spy;
    preloadRoute('/admin');
    // catch 콜백은 microtask 라 다음 tick 에 실행됨. flush.
    await new Promise((resolve) => setTimeout(resolve, 0));
    preloadRoute('/admin');
    expect(spy).toHaveBeenCalledTimes(2);
  });
});
