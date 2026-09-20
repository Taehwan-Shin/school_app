import { describe, it, expect } from 'vitest';
import { ORG_UNIT_NAME_MAX } from '../src/lib/orgUnitLimits';

describe('orgUnitLimits', () => {
  it('ORG_UNIT_NAME_MAX matches Google Admin SDK OrgUnit name 상한 (100자)', () => {
    expect(ORG_UNIT_NAME_MAX).toBe(100);
  });
});
