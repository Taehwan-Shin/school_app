import { describe, it, expect } from 'vitest';
import { handleGetMe } from '../src/callable/getMe.js';

describe('getMe strict validation', () => {
  it('rejects when unauthenticated', () => {
    expect(() => handleGetMe({ auth: null })).toThrow(/인증이 필요합니다/);
  });

  it('rejects when email is missing', () => {
    expect(() =>
      handleGetMe({ auth: { token: { role: 'teacher' } } }),
    ).toThrow(/허용되지 않은 도메인/);
  });

  it('rejects when email domain is not cam.hs.kr', () => {
    expect(() =>
      handleGetMe({ auth: { token: { email: 'intruder@example.com', role: 'teacher' } } }),
    ).toThrow(/허용되지 않은 도메인/);
  });

  it('rejects when role claim is missing (defense in depth)', () => {
    expect(() =>
      handleGetMe({ auth: { token: { email: 'user@cam.hs.kr' } } }),
    ).toThrow(/역할이 아직 부여되지 않았습니다/);
  });

  it('rejects unknown role strings', () => {
    expect(() =>
      handleGetMe({ auth: { token: { email: 'user@cam.hs.kr', role: 'wizard' } } }),
    ).toThrow(/역할이 아직 부여되지 않았습니다/);
  });

  it('returns email and role for valid teacher', () => {
    const result = handleGetMe({
      auth: { token: { email: 'teacher@cam.hs.kr', role: 'teacher' } },
    });
    expect(result).toEqual({ email: 'teacher@cam.hs.kr', role: 'teacher' });
  });

  it('returns email and role for valid admin', () => {
    const result = handleGetMe({
      auth: { token: { email: 'admin@cam.hs.kr', role: 'admin' } },
    });
    expect(result).toEqual({ email: 'admin@cam.hs.kr', role: 'admin' });
  });

  it('returns email and role for valid super_admin', () => {
    const result = handleGetMe({
      auth: { token: { email: 'root@cam.hs.kr', role: 'super_admin' } },
    });
    expect(result).toEqual({ email: 'root@cam.hs.kr', role: 'super_admin' });
  });
});
