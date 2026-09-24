// v0.307: route hover-preload. Sidebar 등 nav Link 가 onMouseEnter/onFocus 로
//         `preloadRoute(path)` 를 호출하면 해당 lazy chunk 를 background 다운로드.
//         사용자가 실제 클릭 시점에는 chunk 가 이미 로드되어 「즉시 이동」 체감.
// - v0.302 route-level lazy 와 조합: lazy() 로 정의된 dynamic import 를 동일한 module
//   specifier 로 다시 호출하면 Vite/Rollup 이 chunk 를 fetch (이후 cache 재사용).
// - idempotent: 같은 path 를 여러 번 호출해도 한 번만 fetch.
// - fetch 실패 시 preloaded 집합에서 제거 → 다음 hover 에서 재시도.
// - Note: preload 는 UX 최적화 · 실 route element 는 여전히 App.tsx 의 lazy() 가 로드.

type RoutePreloadFn = () => Promise<unknown>;

// v0.302 App.tsx 의 lazy() import 경로와 정확히 일치해야 chunk 재사용됨.
export const ROUTE_PRELOAD_MAP: Record<string, RoutePreloadFn> = {
  '/super_admin': () => import('../routes/super_admin'),
  '/super_admin/audit': () => import('../routes/super_admin/audit'),
  '/super_admin/capabilities': () => import('../routes/super_admin/capabilities'),
  '/super_admin/chat': () => import('../routes/admin/chat'),
  '/super_admin/classrooms': () => import('../routes/admin/classrooms'),
  '/admin': () => import('../routes/admin'),
  '/admin/chat': () => import('../routes/admin/chat'),
  '/admin/classrooms': () => import('../routes/admin/classrooms'),
  '/admin/groups': () => import('../routes/admin/groups'),
  '/teacher': () => import('../routes/teacher'),
};

const preloaded = new Set<string>();

export function preloadRoute(path: string): void {
  if (preloaded.has(path)) return;
  const fn = ROUTE_PRELOAD_MAP[path];
  if (!fn) return;
  preloaded.add(path);
  fn().catch(() => {
    // 실패 시 재시도 가능하도록 preloaded 에서 제거.
    preloaded.delete(path);
  });
}

// Test helper (production 에서도 사용 가능 · 상태 초기화).
export function _resetPreloadedForTests(): void {
  preloaded.clear();
}
