import { describe, it, expect, vi, beforeEach } from 'vitest';

const signInWithEmailAndPasswordMock = vi.fn();
const createUserWithEmailAndPasswordMock = vi.fn();

vi.mock('firebase/auth', () => ({
  GoogleAuthProvider: vi.fn(() => ({
    setCustomParameters: vi.fn(),
  })),
  signInWithPopup: vi.fn(),
  signOut: vi.fn(),
  onIdTokenChanged: vi.fn(),
  signInWithEmailAndPassword: (...args: any[]) => signInWithEmailAndPasswordMock(...args),
  createUserWithEmailAndPassword: (...args: any[]) => createUserWithEmailAndPasswordMock(...args),
}));

vi.mock('../src/lib/firebase.js', () => ({
  auth: { name: 'mock-auth' },
  app: {},
  db: {},
  functions: {},
}));

import { signInWithEmulator } from '../src/lib/auth.js';

describe('signInWithEmulator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('attempts signInWithEmailAndPassword first and succeeds if user exists', async () => {
    signInWithEmailAndPasswordMock.mockResolvedValueOnce({ user: { uid: 'u1', email: 'test@cam.hs.kr' } });

    await signInWithEmulator('test@cam.hs.kr');

    expect(signInWithEmailAndPasswordMock).toHaveBeenCalledWith(
      expect.anything(),
      'test@cam.hs.kr',
      'password',
    );
    expect(createUserWithEmailAndPasswordMock).not.toHaveBeenCalled();
  });

  it('falls back to createUserWithEmailAndPassword if sign-in fails', async () => {
    signInWithEmailAndPasswordMock.mockRejectedValueOnce(new Error('user-not-found'));
    createUserWithEmailAndPasswordMock.mockResolvedValueOnce({ user: { uid: 'u2', email: 'test@cam.hs.kr' } });

    await signInWithEmulator('test@cam.hs.kr');

    expect(signInWithEmailAndPasswordMock).toHaveBeenCalledWith(
      expect.anything(),
      'test@cam.hs.kr',
      'password',
    );
    expect(createUserWithEmailAndPasswordMock).toHaveBeenCalledWith(
      expect.anything(),
      'test@cam.hs.kr',
      'password',
    );
  });
});
