export type Capability =
  | 'users.read'
  | 'users.write'
  | 'users.delete'
  | 'users.reset_password'
  | 'groups.read'
  | 'groups.write'
  | 'groups.delete'
  | 'chat.read'
  | 'chat.write'
  | 'chat.delete'
  | 'classroom.read'
  | 'classroom.write'
  | 'classroom.transfer_owner'
  | 'classroom.archive'
  | 'basic_data.read'
  | 'basic_data.write'
  | 'audit.read'
  | 'system.manage_roles';

export const ALL_CAPABILITIES: readonly Capability[] = [
  'users.read',
  'users.write',
  'users.delete',
  'users.reset_password',
  'groups.read',
  'groups.write',
  'groups.delete',
  'chat.read',
  'chat.write',
  'chat.delete',
  'classroom.read',
  'classroom.write',
  'classroom.transfer_owner',
  'classroom.archive',
  'basic_data.read',
  'basic_data.write',
  'audit.read',
  'system.manage_roles',
] as const;
