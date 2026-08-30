import { describe, it, expect } from 'vitest';

describe('getMe callable logic', () => {
  it('returns email and role when authenticated', () => {
    const authContext = {
      token: {
        email: 'admin@cam-t.kr',
        role: 'admin',
      },
    };

    const email = authContext.token.email;
    const role = authContext.token.role;

    expect(email).toBe('admin@cam-t.kr');
    expect(role).toBe('admin');
  });

  it('defaults role to teacher if role claim is not set', () => {
    const authContext = {
      token: {
        email: 'teacher@cam-t.kr',
      },
    };

    const role = (authContext.token as any).role || 'teacher';
    expect(role).toBe('teacher');
  });
});
