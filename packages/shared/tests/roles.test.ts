import { describe, it, expect } from 'vitest';
import { ROLES, ALL_CAPABILITIES, ROLE_CAPABILITIES, userHasCap } from '../src/index.js';

describe('Role and Capability Matrix', () => {
  it('has 3 defined roles', () => {
    expect(ROLES).toEqual(['super_admin', 'admin', 'teacher']);
  });

  it('super_admin has all capabilities', () => {
    const superAdminCaps = ROLE_CAPABILITIES.super_admin;
    for (const cap of ALL_CAPABILITIES) {
      expect(superAdminCaps.has(cap)).toBe(true);
      expect(userHasCap('super_admin', cap)).toBe(true);
    }
  });

  it('admin has all capabilities except audit.read and system.manage_roles', () => {
    const adminCaps = ROLE_CAPABILITIES.admin;
    expect(adminCaps.has('audit.read')).toBe(false);
    expect(adminCaps.has('system.manage_roles')).toBe(false);
    expect(userHasCap('admin', 'audit.read')).toBe(false);
    expect(userHasCap('admin', 'system.manage_roles')).toBe(false);

    expect(userHasCap('admin', 'users.read')).toBe(true);
    expect(userHasCap('admin', 'users.write')).toBe(true);
    expect(userHasCap('admin', 'groups.write')).toBe(true);
    expect(userHasCap('admin', 'classroom.write')).toBe(true);
  });

  it('teacher has only classroom.read, classroom.write, classroom.archive', () => {
    const teacherCaps = ROLE_CAPABILITIES.teacher;
    expect(teacherCaps.size).toBe(3);
    expect(teacherCaps.has('classroom.read')).toBe(true);
    expect(teacherCaps.has('classroom.write')).toBe(true);
    expect(teacherCaps.has('classroom.archive')).toBe(true);

    expect(userHasCap('teacher', 'users.read')).toBe(false);
    expect(userHasCap('teacher', 'classroom.transfer_owner')).toBe(false);
    expect(userHasCap('teacher', 'audit.read')).toBe(false);
  });

  it('handles undefined or invalid role safely', () => {
    expect(userHasCap(undefined, 'users.read')).toBe(false);
    expect(userHasCap(null, 'users.read')).toBe(false);
    expect(userHasCap('unknown_role', 'users.read')).toBe(false);
  });
});
