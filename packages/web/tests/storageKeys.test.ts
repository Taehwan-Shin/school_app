import { describe, it, expect } from 'vitest';
import { StorageKeys } from '../src/lib/storageKeys';

// v0.224: storage key catalog · 값 정확성 회귀.
// - 모든 키 값이 이전 인라인 상수와 정확히 일치해야 (v0.220~v0.222 이식 이후 저장된 값을
//   그대로 읽을 수 있어야 하는 호환성 계약).
describe('StorageKeys (v0.224 catalog)', () => {
  it('accounts 3 keys', () => {
    expect(StorageKeys.accounts.pageSize).toBe('accountsTable.pageSize.v1');
    expect(StorageKeys.accounts.sort).toBe('accountsTable.sort.v1');
    expect(StorageKeys.accounts.visibleColumns).toBe('accountsTable.visibleColumns.v1');
  });

  it('groups 3 keys', () => {
    expect(StorageKeys.groups.pageSize).toBe('groupsTable.pageSize.v1');
    expect(StorageKeys.groups.sort).toBe('groupsTable.sort.v1');
    expect(StorageKeys.groups.visibleColumns).toBe('groupsTable.visibleColumns.v1');
  });

  it('classroom 3 keys', () => {
    expect(StorageKeys.classroom.pageSize).toBe('classroomTable.pageSize.v1');
    expect(StorageKeys.classroom.sort).toBe('classroomTable.sort.v1');
    expect(StorageKeys.classroom.visibleColumns).toBe('classroomTable.visibleColumns.v1');
  });

  it('auditLog 2 keys (sort 없음 · URL param 사용)', () => {
    expect(StorageKeys.auditLog.pageSize).toBe('auditLogTable.pageSize.v1');
    expect(StorageKeys.auditLog.visibleColumns).toBe('auditLogTable.visibleColumns.v1');
  });

  it('theme (전역)', () => {
    expect(StorageKeys.theme).toBe('theme');
  });
});
