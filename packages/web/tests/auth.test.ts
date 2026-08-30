import { describe, it, expect, vi, beforeEach } from 'vitest';

const signInWithEmailAndPasswordMock = vi.fn();
const createUserWithEmailAndPasswordMock = vi.fn();
const signInWithPopupMock = vi.fn();
const signOutMock = vi.fn();
const credentialFromResultMock = vi.fn();

vi.mock('firebase/auth', () => {
  const GoogleAuthProvider = vi.fn(() => ({
    setCustomParameters: vi.fn(),
  }));
  (GoogleAuthProvider as any).credentialFromResult = (...args: any[]) => credentialFromResultMock(...args);

  return {
    GoogleAuthProvider,
    signInWithPopup: (...args: any[]) => signInWithPopupMock(...args),
    signOut: (...args: any[]) => signOutMock(...args),
    onIdTokenChanged: vi.fn(),
    signInWithEmailAndPassword: (...args: any[]) => signInWithEmailAndPasswordMock(...args),
    createUserWithEmailAndPassword: (...args: any[]) => createUserWithEmailAndPasswordMock(...args),
  };
});

vi.mock('../src/lib/firebase.js', () => ({
  auth: { name: 'mock-auth' },
  app: {},
  db: {},
  functions: {},
}));

import {
  signInWithEmulator,
  signInWithGoogle,
  signOut,
  getGoogleAccessTokenFromSession,
  setGoogleAccessTokenToSession,
  clearGoogleAccessTokenFromSession,
} from '../src/lib/auth.js';

describe('Auth & Session Helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  describe('Session Token Helpers', () => {
    it('manages googleAccessToken in sessionStorage', () => {
      expect(getGoogleAccessTokenFromSession()).toBeNull();
      setGoogleAccessTokenToSession('token-123');
      expect(getGoogleAccessTokenFromSession()).toBe('token-123');
      clearGoogleAccessTokenFromSession();
      expect(getGoogleAccessTokenFromSession()).toBeNull();
    });
  });

  describe('signInWithGoogle', () => {
    it('stores google access token in session storage when available in credential', async () => {
      signInWithPopupMock.mockResolvedValueOnce({ user: { uid: 'u1' } });
      credentialFromResultMock.mockReturnValueOnce({ accessToken: 'google-oauth-token-xyz' });

      await signInWithGoogle();

      expect(signInWithPopupMock).toHaveBeenCalled();
      expect(getGoogleAccessTokenFromSession()).toBe('google-oauth-token-xyz');
    });

    it('does not crash if credential has no access token', async () => {
      signInWithPopupMock.mockResolvedValueOnce({ user: { uid: 'u1' } });
      credentialFromResultMock.mockReturnValueOnce(null);

      await signInWithGoogle();

      expect(signInWithPopupMock).toHaveBeenCalled();
      expect(getGoogleAccessTokenFromSession()).toBeNull();
    });
  });

  describe('signInWithEmulator', () => {
    it('attempts signInWithEmailAndPassword first and sets fake token', async () => {
      signInWithEmailAndPasswordMock.mockResolvedValueOnce({ user: { uid: 'u1', email: 'test@cam.hs.kr' } });

      await signInWithEmulator('test@cam.hs.kr');

      expect(signInWithEmailAndPasswordMock).toHaveBeenCalledWith(
        expect.anything(),
        'test@cam.hs.kr',
        'password',
      );
      expect(createUserWithEmailAndPasswordMock).not.toHaveBeenCalled();
      expect(getGoogleAccessTokenFromSession()).toBe('emulator-fake-token');
    });

    it('falls back to createUserWithEmailAndPassword if sign-in fails and sets fake token', async () => {
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
      expect(getGoogleAccessTokenFromSession()).toBe('emulator-fake-token');
    });
  });

  describe('signOut', () => {
    it('clears session token and calls firebase signOut', async () => {
      setGoogleAccessTokenToSession('some-token');
      signOutMock.mockResolvedValueOnce(undefined);

      await signOut();

      expect(getGoogleAccessTokenFromSession()).toBeNull();
      expect(signOutMock).toHaveBeenCalled();
    });
  });
});
