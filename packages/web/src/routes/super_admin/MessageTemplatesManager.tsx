import { useState } from 'react';
import { Button } from '../../components/ui/button';
import { Banner } from '../../components/Banner';
import {
  useDeleteMessageTemplate,
  useMessageTemplates,
  useUpsertMessageTemplate,
  type MessageTemplate,
} from '../../api/messages';
import { MAIL_BODY_MAX, SUBJECT_MAX, TEMPLATE_VARIABLES } from '../../lib/messageTemplate';

// v0.334: 시스템 설정 — 저장된 메시지 문구 (계정 삭제 안내 포함) 를 한곳에서 보고 고치고 지운다.
// 서버 v0.322/v0.325 messageTemplates* callable 재사용.

const INPUT =
  'w-full border border-border-subtle bg-canvas px-3 py-2 text-body text-fg-primary focus:outline-none focus:border-border-strong focus:ring-1 focus:ring-border-strong';

interface Draft {
  id: string;
  name: string;
  subject: string;
  body: string;
  isNew: boolean;
}

function toDraft(t: MessageTemplate): Draft {
  return { id: t.id, name: t.name, subject: t.subject, body: t.body, isNew: false };
}

export function MessageTemplatesManager() {
  const query = useMessageTemplates();
  const upsert = useUpsertMessageTemplate();
  const del = useDeleteMessageTemplate();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const templates = query.data?.templates ?? [];
  // v0.335 (Codex v0.334 R1): 저장/삭제 요청 중에는 다른 편집 전환 · 삭제를 막는다.
  const busy = upsert.isPending || del.isPending;

  const subjectBad = !!draft && (draft.subject.length > SUBJECT_MAX || /[\r\n]/.test(draft.subject));
  const canSave =
    !!draft && draft.name.trim() !== '' && draft.body.trim() !== '' && draft.body.length <= MAIL_BODY_MAX && !subjectBad;

  const handleSave = async () => {
    if (!draft) return;
    setBanner(null);
    const savedId = draft.id;
    try {
      await upsert.mutateAsync({ id: draft.id, name: draft.name.trim(), subject: draft.subject.trim(), body: draft.body });
      setBanner(`「${draft.name.trim()}」 문구를 저장했습니다.`);
      // 요청 시작 시점이 아니라 「지금」 열려 있는 편집기가 저장한 문구일 때만 닫는다.
      setDraft((cur) => (cur?.id === savedId ? null : cur));
    } catch {
      /* upsert.error 배너 */
    }
  };

  const handleDelete = async (t: MessageTemplate) => {
    if (!window.confirm(`「${t.name}」 문구를 삭제할까요?`)) return;
    setBanner(null);
    try {
      await del.mutateAsync({ id: t.id });
      setBanner(`「${t.name}」 문구를 삭제했습니다.`);
      // stale closure 대신 최신 draft 로 판정 — 삭제된 문구의 편집기만 닫는다.
      setDraft((cur) => (cur?.id === t.id ? null : cur));
    } catch {
      /* del.error 배너 */
    }
  };

  return (
    <div className="space-y-4" data-testid="settings-templates">
      <div className="flex items-center justify-between">
        <p className="text-small text-fg-secondary">
          발송 화면 · 계정 삭제 안내 메일에서 불러오는 문구입니다. 본문 변수: {TEMPLATE_VARIABLES.join(' · ')}
        </p>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setDraft({ id: `t_${Date.now().toString(36)}`, name: '', subject: '', body: '', isNew: true })}
          disabled={busy}
          data-testid="settings-template-new"
        >
          + 새 문구
        </Button>
      </div>
      <Banner variant="success" message={banner} testId="settings-template-banner" />
      <Banner
        variant="error"
        message={
          query.isError
            ? `문구 목록 로드 실패: ${query.error.message}`
            : upsert.error
              ? `저장 실패: ${upsert.error.message}`
              : del.error
                ? `삭제 실패: ${del.error.message}`
                : null
        }
        testId="settings-template-error"
      />
      {query.isLoading && <p className="text-small text-fg-muted">불러오는 중...</p>}
      {!query.isLoading && templates.length === 0 && (
        <p className="text-small text-fg-muted" data-testid="settings-template-empty">
          저장된 문구가 없습니다.
        </p>
      )}
      <ul className="divide-y divide-border-subtle border border-border-subtle" data-testid="settings-template-list">
        {templates.map((t) => (
          <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
            <div className="min-w-0">
              <p className="text-small font-semibold text-fg-primary">{t.name}</p>
              <p className="text-micro text-fg-muted truncate">
                {t.subject || '(제목 없음)'} · {t.updatedBy ?? '-'}
                {t.updatedAt ? ` · ${new Date(t.updatedAt).toLocaleString('ko-KR')}` : ''}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setDraft(toDraft(t))}
                disabled={busy}
                data-testid={`settings-template-edit-${t.id}`}
              >
                수정
              </Button>
              <Button
                variant="secondary"
                size="sm"
                className="text-state-danger"
                onClick={() => handleDelete(t)}
                disabled={busy}
                data-testid={`settings-template-delete-${t.id}`}
              >
                삭제
              </Button>
            </div>
          </li>
        ))}
      </ul>

      {draft && (
        <div className="border border-border-strong p-4 space-y-3" data-testid="settings-template-editor">
          <p className="text-small font-semibold text-fg-primary">{draft.isNew ? '새 문구' : '문구 수정'}</p>
          <div>
            <label htmlFor="settings-template-name" className="text-small text-fg-primary block mb-1">
              이름
            </label>
            <input id="settings-template-name" className={INPUT} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          </div>
          <div>
            <label htmlFor="settings-template-subject" className="text-small text-fg-primary block mb-1">
              메일 제목 (선택)
            </label>
            <input id="settings-template-subject" className={INPUT} value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} />
          </div>
          <div>
            <label htmlFor="settings-template-body" className="text-small text-fg-primary block mb-1">
              본문
            </label>
            <textarea id="settings-template-body" rows={8} className={INPUT} value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} />
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" onClick={() => setDraft(null)} disabled={busy}>
              취소
            </Button>
            <Button onClick={handleSave} disabled={!canSave || upsert.isPending} data-testid="settings-template-save">
              {upsert.isPending ? '저장 중...' : '저장'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
