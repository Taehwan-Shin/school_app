import { describe, it, expect, vi } from 'vitest';

const httpsCallableMock = vi.fn((_fns: any, name: string) => `callable-for-${name}`);

vi.mock('firebase/functions', () => ({
  httpsCallable: (fns: any, name: string) => httpsCallableMock(fns, name),
}));

vi.mock('../src/lib/firebase.js', () => ({
  functions: { region: 'asia-northeast3' },
}));

import { getCallable } from '../src/api/functions.js';

describe('Functions API helper', () => {
  it('returns httpsCallable with functions instance and function name', () => {
    const callable = getCallable('testFunction');
    expect(httpsCallableMock).toHaveBeenCalledWith({ region: 'asia-northeast3' }, 'testFunction');
    expect(callable).toBe('callable-for-testFunction');
  });
});
