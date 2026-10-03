import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { userHasCap } from '@school-app/shared';
import { runAudited, requireText } from './common.js';
import type { AuthenticatedUser } from '../../authz/middleware.js';
import { SUBJECT_MAX, MAIL_BODY_MAX } from './gmailSend.js';

// v0.322: 메시지 문구 템플릿 (Firestore `message_templates/{id}`) · 관리자 공용.
// 예: id `account_deletion_notice` = 계정 삭제 안내 메일. 본문의 {{name}} · {{email}} 은 클라이언트가 치환.

export interface MessageTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  updatedBy?: string;
  updatedAt?: string | null;
}

const ID_RE = /^[a-z0-9_-]{1,64}$/;

// v0.325: 교사도 messages.send 를 갖게 되면서, 학교 공용 「계정 삭제 안내」 문구는 계정 관리 권한
// (users.write) 이 있는 사람만 수정·삭제. 다른 문구는 messages.send 로 충분.
const ADMIN_ONLY_TEMPLATE_IDS = new Set(['account_deletion_notice']);

function assertCanWriteTemplate(user: AuthenticatedUser, id: string): void {
  if (ADMIN_ONLY_TEMPLATE_IDS.has(id) && !userHasCap(user.role, 'users.write')) {
    throw new HttpsError('permission-denied', 'template_admin_only');
  }
}
const NAME_MAX = 100;
const COLLECTION = 'message_templates';
const NO_SCOPES: readonly string[] = [];

function toTemplate(id: string, d: FirebaseFirestore.DocumentData): MessageTemplate {
  const at = d.updatedAt;
  return {
    id,
    name: String(d.name ?? id),
    subject: String(d.subject ?? ''),
    body: String(d.body ?? ''),
    updatedBy: typeof d.updatedBy === 'string' ? d.updatedBy : undefined,
    updatedAt: at && typeof at.toDate === 'function' ? at.toDate().toISOString() : null,
  };
}

export const messageTemplatesList = onCall({ region: 'asia-northeast3', cors: true }, async (request) =>
  runAudited<{ templates: MessageTemplate[] }>(
    request,
    // 조회는 감사 노이즈를 줄이기 위해 messages.send 와 같은 action 이 아닌 read 성 action 으로.
    { action: 'messages.templates.read', target: COLLECTION, cap: 'messages.send', scopes: NO_SCOPES },
    async () => {
      const snap = await getFirestore().collection('message_templates').get();
      const templates = snap.docs.map((doc) => toTemplate(doc.id, doc.data()));
      templates.sort((a, b) => a.name.localeCompare(b.name, 'ko'));
      return { result: { templates }, message: `listed ${templates.length}` };
    },
  ),
);

export const messageTemplatesUpsert = onCall({ region: 'asia-northeast3', cors: true }, async (request) => {
  const data = (request.data ?? {}) as Partial<MessageTemplate>;
  const idPart = typeof data.id === 'string' && data.id ? data.id : '*';
  return runAudited<{ template: MessageTemplate }>(
    request,
    { action: 'messages.templates.write', target: `${COLLECTION}/${idPart}`, cap: 'messages.send', scopes: NO_SCOPES },
    async (user) => {
      const id = typeof data.id === 'string' ? data.id : '';
      if (!ID_RE.test(id)) throw new HttpsError('invalid-argument', 'invalid_template_id');
      assertCanWriteTemplate(user, id);
      const name = requireText(data.name, 'name', NAME_MAX, { singleLine: true });
      // 제목은 비워도 됨 (챗 전용 문구). 있으면 한 줄 · 상한.
      const subject = typeof data.subject === 'string' ? data.subject.trim() : '';
      if (subject.length > SUBJECT_MAX || /[\r\n]/.test(subject)) {
        throw new HttpsError('invalid-argument', 'invalid_subject');
      }
      const body = requireText(data.body, 'body', MAIL_BODY_MAX);
      const ref = getFirestore().collection('message_templates').doc(id);
      await ref.set({ name, subject, body, updatedBy: user.email, updatedAt: FieldValue.serverTimestamp() });
      return {
        result: { template: { id, name, subject, body, updatedBy: user.email, updatedAt: null } },
        message: `body_len=${body.length}`,
      };
    },
  );
});

export const messageTemplatesDelete = onCall({ region: 'asia-northeast3', cors: true }, async (request) => {
  const data = (request.data ?? {}) as { id?: unknown };
  const id = typeof data.id === 'string' ? data.id : '';
  return runAudited<{ deleted: true; id: string }>(
    request,
    { action: 'messages.templates.write', target: `${COLLECTION}/${id || '*'}`, cap: 'messages.send', scopes: NO_SCOPES },
    async (user) => {
      if (!ID_RE.test(id)) throw new HttpsError('invalid-argument', 'invalid_template_id');
      assertCanWriteTemplate(user, id);
      await getFirestore().collection('message_templates').doc(id).delete();
      return { result: { deleted: true, id }, message: 'deleted' };
    },
  );
});
