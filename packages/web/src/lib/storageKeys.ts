// v0.224: 모든 웹 localStorage 키를 한 곳에 상수로 모아 관리.
// - 이전에는 각 테이블/모듈이 `const XXX_STORAGE_KEY = '...v1'` 을 인라인으로 선언 (총 11+ 곳).
// - 키 rename 이나 v2 마이그레이션 시 한 곳만 수정하면 되도록 통합.
// - 값은 그대로 유지 (backward compat).
//
// 참조:
//   - v0.220 `pageSizeStorage.ts`
//   - v0.221 `sortStorage.ts`
//   - v0.222 `visibleColumnsStorage.ts`
//   - v0.223 `theme.tsx` (별도 세션 진행 중)

export const StorageKeys = {
  accounts: {
    pageSize: 'accountsTable.pageSize.v1',
    sort: 'accountsTable.sort.v1',
    visibleColumns: 'accountsTable.visibleColumns.v1',
  },
  groups: {
    pageSize: 'groupsTable.pageSize.v1',
    sort: 'groupsTable.sort.v1',
    visibleColumns: 'groupsTable.visibleColumns.v1',
  },
  classroom: {
    pageSize: 'classroomTable.pageSize.v1',
    sort: 'classroomTable.sort.v1',
    visibleColumns: 'classroomTable.visibleColumns.v1',
  },
  auditLog: {
    pageSize: 'auditLogTable.pageSize.v1',
    visibleColumns: 'auditLogTable.visibleColumns.v1',
  },
  theme: 'theme',
} as const;
