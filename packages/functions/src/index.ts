import { initializeApp, getApps } from 'firebase-admin/app';

if (getApps().length === 0) {
  initializeApp();
}

export { onUserCreate } from './auth/onUserCreate.js';
export { getMe } from './callable/getMe.js';
export { usersList } from './callable/users/list.js';
export { usersCreate } from './callable/users/create.js';
export { usersDelete } from './callable/users/delete.js';
export { usersUpdate } from './callable/users/update.js';
export { auditLogList } from './callable/audit/list.js';
export { auditLogCount } from './callable/audit/count.js';
export { auditLogSummary } from './callable/audit/summary.js';
export { groupsList } from './callable/groups/list.js';
export { groupsCreate } from './callable/groups/create.js';
export { groupsUpdate } from './callable/groups/update.js';
export { groupsDelete } from './callable/groups/delete.js';
export { groupsMembersList } from './callable/groups/members/list.js';
export { groupsMembersInsert } from './callable/groups/members/insert.js';
export { groupsMembersDelete } from './callable/groups/members/delete.js';
export { groupsMembersUpdate } from './callable/groups/members/update.js';
export { usersResetPassword } from './callable/users/resetPassword.js';
export { usersUpdateRole } from './callable/users/updateRole.js';
export { basicDataGet } from './callable/basicData/get.js';
export { basicDataSet } from './callable/basicData/set.js';
export { basicDataListYears } from './callable/basicData/listYears.js';
export { chatList } from './callable/chat/list.js';
export { chatCreate } from './callable/chat/create.js';
export { chatDelete } from './callable/chat/delete.js';
export { chatMembersList } from './callable/chat/membersList.js';
export { chatMembersAdd } from './callable/chat/membersAdd.js';
export { chatMembersDelete } from './callable/chat/membersDelete.js';
export { classroomList } from './callable/classroom/list.js';
export { classroomPatch } from './callable/classroom/patch.js';
export { classroomDelete } from './callable/classroom/delete.js';
export { classroomTeachersList } from './callable/classroom/teachersList.js';
export { classroomStudentsList } from './callable/classroom/studentsList.js';
export { classroomTeachersAdd } from './callable/classroom/teachersAdd.js';
export { classroomTeachersDelete } from './callable/classroom/teachersDelete.js';
export { classroomStudentsAdd } from './callable/classroom/studentsAdd.js';
export { classroomStudentsDelete } from './callable/classroom/studentsDelete.js';
export { classroomCreate } from './callable/classroom/create.js';

