import { describe, it, expect, vi, beforeEach } from 'vitest';

const createDocMock = vi.fn();
const docMock = vi.fn(() => ({ create: createDocMock }));
const collectionMock = vi.fn(() => ({ doc: docMock }));

vi.mock('firebase-admin/firestore', () => ({
  getFirestore: () => ({ collection: collectionMock }),
  FieldValue: {
    serverTimestamp: () => 'MOCK_TIMESTAMP',
  },
}));

import { handleUserCreate } from '../src/auth/onUserCreate.js';

describe('beforeUserCreated blocking trigger (pure handler)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createDocMock.mockResolvedValue(undefined);
  });

  it('creates users/{uid} and returns teacher role customClaims for @cam.hs.kr', async () => {
    const result = await handleUserCreate({
      uid: 'user-123',
      email: 'teacher1@cam.hs.kr',
      displayName: '홍길동',
    });

    expect(result).toEqual({
      action: 'created',
      role: 'teacher',
      customClaims: { role: 'teacher' },
    });
    expect(collectionMock).toHaveBeenCalledWith('users');
    expect(docMock).toHaveBeenCalledWith('user-123');
    expect(createDocMock).toHaveBeenCalledWith({
      email: 'teacher1@cam.hs.kr',
      displayName: '홍길동',
      role: 'teacher',
      createdAt: 'MOCK_TIMESTAMP',
      lastSeenAt: 'MOCK_TIMESTAMP',
    });
  });

  it('throws HttpsError(permission-denied) for outside domain and never touches Firestore', async () => {
    await expect(
      handleUserCreate({
        uid: 'intruder-456',
        email: 'test@example.com',
        displayName: '외부인',
      }),
    ).rejects.toMatchObject({ code: 'permission-denied' });

    expect(createDocMock).not.toHaveBeenCalled();
    expect(collectionMock).not.toHaveBeenCalled();
  });

  it('throws HttpsError(permission-denied) for missing email', async () => {
    await expect(
      handleUserCreate({ uid: 'no-email-789', email: null, displayName: null }),
    ).rejects.toMatchObject({ code: 'permission-denied' });

    expect(createDocMock).not.toHaveBeenCalled();
  });
});
