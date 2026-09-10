// 서버 callable 들이 writeAudit(action=...) 로 기록하는 액션 문자열의 목록.
// 클라이언트 UI 에서 필터 드롭다운을 구성할 때 참조. 서버는 이 상수를 강제하지 않고
// 임의의 액션 문자열을 허용 (미래 신규 액션이 목록 없이도 감사 저장은 가능).
export const AUDIT_ACTIONS: readonly string[] = [
  'users.read',
  'users.write',
  'users.delete',
  'users.reset_password',
  'users.update_role',
  'groups.read',
  'groups.write',
  'groups.delete',
  'chat.read',
  'chat.write',
  'chat.delete',
  'chat.members.add',
  'chat.members.delete',
  'classroom.read',
  'classroom.write',
  'classroom.create',
  'classroom.delete',
  'classroom.teachers.add',
  'classroom.teachers.delete',
  'classroom.students.add',
  'classroom.students.delete',
  'basic_data.read',
  'basic_data.write',
  'audit.read',
  'created',
  // v0.106: super_admin 카드가 「Auth claim ≠ Firestore role」 분기 상태를 server 필터로
  // 정확히 셀 수 있도록 도입. getRole callable 이 감지 시 이 action 으로도 별도 기록.
  'system.role_split_detected',
  // v0.107: super_admin 이 감지된 split 을 Firestore = Auth 로 자동 동기화 (resolveRoleSplit
  // callable). 감사 페이지에서 detected → resolved 흐름을 시간순으로 추적할 수 있게 별도 action.
  'system.role_split_resolved',
] as const;
