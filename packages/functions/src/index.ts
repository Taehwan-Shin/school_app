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
export { groupsList } from './callable/groups/list.js';
export { groupsCreate } from './callable/groups/create.js';
export { groupsUpdate } from './callable/groups/update.js';


