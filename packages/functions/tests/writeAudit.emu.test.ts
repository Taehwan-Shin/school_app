import { describe, it, expect, beforeAll } from 'vitest';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { writeAudit } from '../src/audit/writeAudit.js';

const PROJECT_ID = 'demo-school';

describe('writeAudit integration (Firestore Emulator)', () => {
  let db: FirebaseFirestore.Firestore;

  beforeAll(() => {
    if (!process.env.FIRESTORE_EMULATOR_HOST) {
      process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8085';
    }
    process.env.GCLOUD_PROJECT = PROJECT_ID;

    const app = getApps().length === 0 ? initializeApp({ projectId: PROJECT_ID }) : getApps()[0];
    db = getFirestore(app);
  });

  it('persists audit_log document with accurate fields and serverTimestamp', async () => {
    const requestId = `req-emu-${Date.now()}`;
    await writeAudit({
      actor: 'admin-emu@cam.hs.kr',
      role: 'admin',
      action: 'users.read',
      target: '*',
      request_id: requestId,
      result: 'ok',
      message: 'listed 5 users',
    });

    const snapshot = await db.collection('audit_log').where('request_id', '==', requestId).get();
    expect(snapshot.empty).toBe(false);
    expect(snapshot.docs).toHaveLength(1);

    const doc = snapshot.docs[0].data();
    expect(doc.actor).toBe('admin-emu@cam.hs.kr');
    expect(doc.role).toBe('admin');
    expect(doc.action).toBe('users.read');
    expect(doc.target).toBe('*');
    expect(doc.request_id).toBe(requestId);
    expect(doc.result).toBe('ok');
    expect(doc.message).toBe('listed 5 users');
    expect(doc.at).toBeInstanceOf(Timestamp);
  });

  it('records denied action with before and after payloads', async () => {
    const requestId = `req-emu-denied-${Date.now()}`;
    await writeAudit({
      actor: 'teacher-emu@cam.hs.kr',
      role: 'teacher',
      action: 'users.write',
      target: 'target-user-id',
      request_id: requestId,
      result: 'denied',
      before: { status: 'active' },
      after: { status: 'suspended' },
      message: 'permission-denied: users.write',
    });

    const snapshot = await db.collection('audit_log').where('request_id', '==', requestId).get();
    expect(snapshot.empty).toBe(false);
    const doc = snapshot.docs[0].data();
    expect(doc.actor).toBe('teacher-emu@cam.hs.kr');
    expect(doc.role).toBe('teacher');
    expect(doc.result).toBe('denied');
    expect(doc.before).toEqual({ status: 'active' });
    expect(doc.after).toEqual({ status: 'suspended' });
  });

  it('records error action when unexpected failure occurs', async () => {
    const requestId = `req-emu-err-${Date.now()}`;
    await writeAudit({
      actor: 'super-emu@cam.hs.kr',
      role: 'super_admin',
      action: 'users.delete',
      target: 'target-uid',
      request_id: requestId,
      result: 'error',
      message: 'Google Admin API 500 Internal Server Error',
    });

    const snapshot = await db.collection('audit_log').where('request_id', '==', requestId).get();
    expect(snapshot.empty).toBe(false);
    const doc = snapshot.docs[0].data();
    expect(doc.result).toBe('error');
    expect(doc.message).toBe('Google Admin API 500 Internal Server Error');
  });
});
