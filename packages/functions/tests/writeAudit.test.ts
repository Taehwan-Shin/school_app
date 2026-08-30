import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockAdd = vi.fn();
const mockCollection = vi.fn().mockReturnValue({ add: mockAdd });
const mockFirestore = { collection: mockCollection };

vi.mock('firebase-admin/firestore', () => ({
  getFirestore: () => mockFirestore,
  FieldValue: {
    serverTimestamp: () => 'MOCK_SERVER_TIMESTAMP',
  },
}));

import { writeAudit, AuditEntry } from '../src/audit/writeAudit.js';

describe('writeAudit unit tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAdd.mockResolvedValue({ id: 'audit-doc-123' });
  });

  it('writes required fields to audit_log collection with serverTimestamp', async () => {
    const entry: AuditEntry = {
      actor: 'admin@cam.hs.kr',
      role: 'admin',
      action: 'users.read',
      target: '*',
      request_id: 'req-001',
      result: 'ok',
    };

    await writeAudit(entry);

    expect(mockCollection).toHaveBeenCalledWith('audit_log');
    expect(mockAdd).toHaveBeenCalledTimes(1);
    expect(mockAdd).toHaveBeenCalledWith({
      actor: 'admin@cam.hs.kr',
      role: 'admin',
      action: 'users.read',
      target: '*',
      request_id: 'req-001',
      result: 'ok',
      at: 'MOCK_SERVER_TIMESTAMP',
    });
  });

  it('writes optional fields (before, after, message) when present', async () => {
    const entry: AuditEntry = {
      actor: 'super@cam.hs.kr',
      role: 'super_admin',
      action: 'users.write',
      target: 'user-456',
      request_id: 'req-002',
      result: 'ok',
      before: { name: 'Old Name' },
      after: { name: 'New Name' },
      message: 'User updated successfully',
    };

    await writeAudit(entry);

    expect(mockCollection).toHaveBeenCalledWith('audit_log');
    expect(mockAdd).toHaveBeenCalledWith({
      actor: 'super@cam.hs.kr',
      role: 'super_admin',
      action: 'users.write',
      target: 'user-456',
      request_id: 'req-002',
      result: 'ok',
      before: { name: 'Old Name' },
      after: { name: 'New Name' },
      message: 'User updated successfully',
      at: 'MOCK_SERVER_TIMESTAMP',
    });
  });

  it('handles denied and error audit entries', async () => {
    const deniedEntry: AuditEntry = {
      actor: 'teacher@cam.hs.kr',
      role: 'teacher',
      action: 'users.read',
      target: '*',
      request_id: 'req-003',
      result: 'denied',
      message: 'permission-denied: users.read',
    };

    await writeAudit(deniedEntry);

    expect(mockAdd).toHaveBeenCalledWith({
      actor: 'teacher@cam.hs.kr',
      role: 'teacher',
      action: 'users.read',
      target: '*',
      request_id: 'req-003',
      result: 'denied',
      message: 'permission-denied: users.read',
      at: 'MOCK_SERVER_TIMESTAMP',
    });
  });
});
