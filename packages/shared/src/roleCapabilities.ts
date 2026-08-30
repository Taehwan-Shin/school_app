import type { Role } from './roles.js';
import type { Capability } from './capabilities.js';
import { ALL_CAPABILITIES } from './capabilities.js';

export const ROLE_CAPABILITIES: Record<Role, ReadonlySet<Capability>> = {
  super_admin: new Set<Capability>(ALL_CAPABILITIES),
  admin: new Set<Capability>(
    ALL_CAPABILITIES.filter((c) => c !== 'audit.read' && c !== 'system.manage_roles')
  ),
  teacher: new Set<Capability>(['classroom.read', 'classroom.write', 'classroom.archive']),
};

export function userHasCap(role: Role | string | undefined | null, capability: Capability): boolean {
  if (!role || (role !== 'super_admin' && role !== 'admin' && role !== 'teacher')) {
    return false;
  }
  const caps = ROLE_CAPABILITIES[role as Role];
  return caps ? caps.has(capability) : false;
}
