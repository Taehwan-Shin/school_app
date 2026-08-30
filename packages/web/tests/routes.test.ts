import { describe, it, expect } from 'vitest';
import { ROLE_ROUTE_MAP, getRouteForRole } from '../src/routes/routeMap.js';

describe('Web Route Map & Role Gating', () => {
  it('maps each role to its corresponding route without hardcoded if/else chains', () => {
    expect(ROLE_ROUTE_MAP.super_admin).toBe('/super_admin');
    expect(ROLE_ROUTE_MAP.admin).toBe('/admin');
    expect(ROLE_ROUTE_MAP.teacher).toBe('/teacher');
  });

  it('resolves valid role paths correctly', () => {
    expect(getRouteForRole('super_admin')).toBe('/super_admin');
    expect(getRouteForRole('admin')).toBe('/admin');
    expect(getRouteForRole('teacher')).toBe('/teacher');
  });

  it('falls back to /login when role is invalid or not logged in', () => {
    expect(getRouteForRole(null)).toBe('/login');
    expect(getRouteForRole(undefined)).toBe('/login');
    expect(getRouteForRole('invalid_role' as any)).toBe('/login');
  });
});
