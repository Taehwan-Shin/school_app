import { describe, it, expect, vi, beforeEach } from 'vitest';

const deleteUserMock = vi.fn();
const setCustomUserClaimsMock = vi.fn();
const createDocMock = vi.fn();
const docMock = vi.fn(() => ({
  create: createDocMock,
}));
const collectionMock = vi.fn(() => ({
  doc: docMock,
}));

vi.mock('firebase-admin/auth', () => ({
  getAuth: () => ({
    deleteUser: deleteUserMock,
    setCustomUserClaims: setCustomUserClaimsMock,
  }),
}));

vi.mock('firebase-admin/firestore', () => ({
  getFirestore: () => ({
    collection: collectionMock,
  }),
  FieldValue: {
    serverTimestamp: () => 'MOCK_TIMESTAMP',
  },
}));

import { handleUserCreate } from '../src/auth/onUserCreate.js';

describe('onUserCreate Auth Trigger', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    deleteUserMock.mockResolvedValue(undefined);
    setCustomUserClaimsMock.mockResolvedValue(undefined);
    createDocMock.mockResolvedValue(undefined);
  });

  it('allows user with @cam-t.kr, sets teacher role custom claim and creates users/{uid} document', async () => {
    const user = {
      uid: 'user-123',
      email: 'teacher1@cam-t.kr',
      displayName: '홍길동',
    };

    const result = await handleUserCreate(user);

    expect(result).toEqual({ action: 'created', role: 'teacher' });
    expect(deleteUserMock).not.toHaveBeenCalled();
    expect(setCustomUserClaimsMock).toHaveBeenCalledWith('user-123', { role: 'teacher' });
    expect(collectionMock).toHaveBeenCalledWith('users');
    expect(docMock).toHaveBeenCalledWith('user-123');
    expect(createDocMock).toHaveBeenCalledWith({
      email: 'teacher1@cam-t.kr',
      displayName: '홍길동',
      role: 'teacher',
      createdAt: 'MOCK_TIMESTAMP',
      lastSeenAt: 'MOCK_TIMESTAMP',
    });
  });

  it('rejects user with different domain and immediately deletes user', async () => {
    const user = {
      uid: 'intruder-456',
      email: 'test@example.com',
      displayName: '외부인',
    };

    const result = await handleUserCreate(user);

    expect(result).toEqual({ action: 'deleted', reason: 'invalid_domain' });
    expect(deleteUserMock).toHaveBeenCalledWith('intruder-456');
    expect(setCustomUserClaimsMock).not.toHaveBeenCalled();
    expect(createDocMock).not.toHaveBeenCalled();
  });

  it('rejects user with missing or empty email', async () => {
    const user = {
      uid: 'no-email-789',
      email: null,
      displayName: '이메일없음',
    };

    const result = await handleUserCreate(user);

    expect(result).toEqual({ action: 'deleted', reason: 'invalid_domain' });
    expect(deleteUserMock).toHaveBeenCalledWith('no-email-789');
    expect(setCustomUserClaimsMock).not.toHaveBeenCalled();
    expect(createDocMock).not.toHaveBeenCalled();
  });
});
