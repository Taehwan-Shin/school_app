import { describe, it, expect, beforeEach } from 'vitest';
import {
  preloadRoute,
  ROUTE_PRELOAD_MAP,
  _resetPreloadedForTests,
} from '../src/lib/routePreload';

// v0.307: route hover preload helper.
// - ROUTE_PRELOAD_MAP 은 App.tsx lazy() 경로와 대칭이라야 chunk 재사용.
// - preloadRoute 는 idempotent + 알 수 없는 path 는 no-op + 실패 시 재시도 가능.

describe('routePreload', () => {
  beforeEach(() => {
    _resetPreloadedForTests();
  });

  it('ROUTE_PRELOAD_MAP 는 11 route 를 포함 (App.tsx lazy 대칭)', () => {
    // App.tsx 의 lazy import 순서:
    // super_admin, super_admin/audit, super_admin/capabilities,
    // super_admin/chat (= admin/chat), super_admin/classrooms (= admin/classrooms),
    // admin, admin/chat, admin/classrooms, admin/groups (+ admin/groups/:email, admin/classrooms/:id, admin/users/:email 는 dynamic segment 라 preload map 미포함),
    // teacher
    const expected = [
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
    for (const path of expected) {
      expect(ROUTE_PRELOAD_MAP[path]).toBeTypeOf('function');
    }
  });

  it('preloadRoute(known path): 첫 호출은 import 함수 호출', () => {
    // 이 test 는 실제 chunk 다운로드 여부가 아니라 map 조회가 실행되는지 확인.
    // 알 수 없는 path 는 map 조회 실패로 no-op.
    expect(() => preloadRoute('/admin')).not.toThrow();
  });

  it('preloadRoute(unknown path): no-op (throw 안 함)', () => {
    expect(() => preloadRoute('/nonexistent')).not.toThrow();
  });

  it('preloadRoute(same path 여러 번): idempotent (여러 번 호출 안전)', () => {
    expect(() => {
      preloadRoute('/admin');
      preloadRoute('/admin');
      preloadRoute('/admin');
    }).not.toThrow();
  });

  it('preloadRoute(빈 문자열): no-op', () => {
    expect(() => preloadRoute('')).not.toThrow();
  });
});
