import type { Role } from './roles.js';
import type { Capability } from './capabilities.js';
import { ALL_CAPABILITIES } from './capabilities.js';

export const ROLE_CAPABILITIES: Record<Role, ReadonlySet<Capability>> = {
  super_admin: new Set<Capability>(ALL_CAPABILITIES),
  admin: new Set<Capability>(
    ALL_CAPABILITIES.filter((c) => c !== 'audit.read' && c !== 'system.manage_roles')
  ),
  // v0.325: 교사도 메시지 발송 (본인 계정 Gmail · 챗) — bliss00 결정 2026-10-03.
  teacher: new Set<Capability>(['classroom.read', 'classroom.write', 'classroom.archive', 'messages.send']),
};

export function userHasCap(role: Role | string | undefined | null, capability: Capability): boolean {
  if (!role || (role !== 'super_admin' && role !== 'admin' && role !== 'teacher')) {
    return false;
  }
  const caps = ROLE_CAPABILITIES[role as Role];
  return caps ? caps.has(capability) : false;
}
