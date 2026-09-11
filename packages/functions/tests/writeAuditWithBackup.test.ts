import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockWriteAudit = vi.fn();
vi.mock('../src/audit/writeAudit.js', () => ({
  writeAudit: (...args: any[]) => mockWriteAudit(...args),
}));

import { writeAuditWithBackup } from '../src/audit/writeAuditWithBackup.js';

const ENTRY = {
  actor: 'admin@cam.hs.kr',
  role: 'admin' as const,
  action: 'users.write',
  target: 'orgunits/학생/1학년',
  request_id: 'req-abc',
  result: 'ok' as const,
  message: 'created orgunit',
};

describe('writeAuditWithBackup', () => {
  beforeEach(() => {
    mockWriteAudit.mockReset();
  });

  it('첫 시도 성공 → writeAudit 1회만 · console.error 없음', async () => {
    mockWriteAudit.mockResolvedValueOnce(undefined);
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await writeAuditWithBackup(ENTRY, 'req-abc', 'orgunits_create');
    expect(mockWriteAudit).toHaveBeenCalledTimes(1);
    expect(errSpy).not.toHaveBeenCalled();
    errSpy.mockRestore();
  });

  it('1회 실패 · 2회차 성공 → 총 2회 · console.error 없음', async () => {
    mockWriteAudit
      .mockRejectedValueOnce(new Error('transient'))
      .mockResolvedValueOnce(undefined);
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await writeAuditWithBackup(ENTRY, 'req-abc', 'orgunits_create');
    expect(mockWriteAudit).toHaveBeenCalledTimes(2);
    expect(errSpy).not.toHaveBeenCalled();
    errSpy.mockRestore();
  });

  it('3회 모두 실패 → 총 3회 · throw 안 함 · console.error structured JSON', async () => {
    mockWriteAudit.mockRejectedValue(new Error('firestore_unavailable'));
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await expect(
      writeAuditWithBackup(ENTRY, 'req-abc', 'orgunits_create'),
    ).resolves.toBeUndefined();
    expect(mockWriteAudit).toHaveBeenCalledTimes(3);
    // structured JSON.
    expect(errSpy).toHaveBeenCalledTimes(1);
    const logStr = errSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(logStr);
    expect(parsed).toMatchObject({
      severity: 'ERROR',
      message: 'orgunits_create_audit_write_failed',
      request_id: 'req-abc',
      audit_entry: expect.objectContaining({
        actor: 'admin@cam.hs.kr',
        target: 'orgunits/학생/1학년',
      }),
      final_error: 'firestore_unavailable',
    });
    errSpy.mockRestore();
  });

  it('slug 로 fallback message 결정 (BigQuery sink 필터 대상)', async () => {
    mockWriteAudit.mockRejectedValue(new Error('x'));
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await writeAuditWithBackup(ENTRY, 'req-1', 'users_create');
    await writeAuditWithBackup(ENTRY, 'req-2', 'classroom_transfer_owner');
    const msgs = errSpy.mock.calls.map((c: any[]) => JSON.parse(c[0] as string).message);
    expect(msgs).toEqual([
      'users_create_audit_write_failed',
      'classroom_transfer_owner_audit_write_failed',
    ]);
    errSpy.mockRestore();
  });
});
