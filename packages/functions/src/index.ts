import { initializeApp, getApps } from 'firebase-admin/app';

if (getApps().length === 0) {
  initializeApp();
}

export { onUserCreate } from './auth/onUserCreate.js';
export { getMe } from './callable/getMe.js';
export { usersList } from './callable/users/list.js';
export { usersCreate } from './callable/users/create.js';
export { usersDelete } from './callable/users/delete.js';


