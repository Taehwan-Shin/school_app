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
  | 'messages.send'
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
  // v0.322: 메시지 발송 (Gmail · 챗 DM · 챗 스페이스) + 문구 템플릿. admin/super_admin.
  'messages.send',
  'audit.read',
  'system.manage_roles',
] as const;
