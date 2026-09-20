import { describe, it, expect } from 'vitest';
import {
  USER_FAMILY_NAME_MAX,
  USER_GIVEN_NAME_MAX,
  USER_LOCAL_PART_MAX,
} from '../src/lib/userLimits';

describe('userLimits', () => {
  it('USER_FAMILY_NAME_MAX matches Google Directory User name.familyName 상한 (60자)', () => {
    expect(USER_FAMILY_NAME_MAX).toBe(60);
  });

  it('USER_GIVEN_NAME_MAX matches Google Directory User name.givenName 상한 (60자)', () => {
    expect(USER_GIVEN_NAME_MAX).toBe(60);
  });

  it('USER_LOCAL_PART_MAX matches RFC 5321 / Google Workspace local-part 상한 (64자)', () => {
    expect(USER_LOCAL_PART_MAX).toBe(64);
  });
});
