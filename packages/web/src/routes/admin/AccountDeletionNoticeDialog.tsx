import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import { Button } from '../../components/ui/button';
import { Banner } from '../../components/Banner';
import { BulkProgress } from '../../components/BulkProgress';
import { PreviewList } from '../../components/PreviewList';
import { SrOnlyDialogHeader } from '../../components/SrOnlyDialogHeader';
import { SendResults } from '../../components/SendResults';
import { useBulkDialogPhase } from '../../lib/useBulkDialogPhase';
import { useSequentialSend } from '../../lib/useSequentialSend';
import { callGmailSend, useMessageTemplates, useUpsertMessageTemplate } from '../../api/messages';
import {
  ACCOUNT_DELETION_TEMPLATE_ID,
  DEFAULT_ACCOUNT_DELETION_TEMPLATE,
  MAIL_BODY_MAX,
  SUBJECT_MAX,
  TEMPLATE_VARIABLES,
  renderTemplate,
} from '../../lib/messageTemplate';

export interface DeletionNoticeRecipient {
  email: string;
  name: string;
}

export interface AccountDeletionNoticeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipients: DeletionNoticeRecipient[];
  onDone?: () => void;
}

// v0.322: 계정 삭제 안내 메일 (bliss00 요청 2026-10-01). 저장된 문구 (message_templates/
// account_deletion_notice) 를 불러와 체크한 계정마다 {{name}} · {{email}} 치환 후 Gmail 로
// 순차 발송. 로그인한 관리자 본인 계정에서 발송된다. 문구는 이 화면에서 바로 수정 · 저장.
export function AccountDeletionNoticeDialog({
  open,
  onOpenChange,
  recipients,
  onDone,
}: AccountDeletionNoticeDialogProps) {
  const templatesQuery = useMessageTemplates(open);
  const upsert = useUpsertMessageTemplate();
  const sender = useSequentialSend();
  const [subject, setSubject] = useState<string | null>(null);
  const [body, setBody] = useState<string | null>(null);
  const [savedBanner, setSavedBanner] = useState<string | null>(null);
  // F99 대칭: 발송 시점 수신자 snapshot.
  const [runRecipients, setRunRecipients] = useState<DeletionNoticeRecipient[] | null>(null);

  const saved = templatesQuery.data?.templates.find((t) => t.id === ACCOUNT_DELETION_TEMPLATE_ID);
  const base = saved ?? DEFAULT_ACCOUNT_DELETION_TEMPLATE;
  // 편집 전에는 저장된 문구 (없으면 기본 문구) 를 그대로 보여준다.
  const currentSubject = subject ?? base.subject;
  const currentBody = body ?? base.body;

  const { phase, setPhase, handleOpenChange } = useBulkDialogPhase({
    open,
    onOpenChange,
    onDone,
    onOpen: () => {
      setSubject(null);
      setBody(null);
      setSavedBanner(null);
      setRunRecipients(null);
      sender.reset();
      upsert.reset();
    },
  });

  const subjectInvalid = !currentSubject.trim() || currentSubject.length > SUBJECT_MAX;
  const bodyInvalid = !currentBody.trim() || currentBody.length > MAIL_BODY_MAX;
  const isDirty = currentSubject !== base.subject || currentBody !== base.body || !saved;

  const handleSave = async () => {
    setSavedBanner(null);
    try {
      await upsert.mutateAsync({
        id: ACCOUNT_DELETION_TEMPLATE_ID,
        name: DEFAULT_ACCOUNT_DELETION_TEMPLATE.name,
        subject: currentSubject.trim(),
        body: currentBody,
      });
      setSubject(null);
      setBody(null);
      setSavedBanner('문구를 저장했습니다. 다음부터 자동으로 불러옵니다.');
    } catch {
      // 오류는 upsert.error 배너로 표시.
    }
  };

  const handleSend = async () => {
    const snapshot = [...recipients];
    const subj = currentSubject.trim();
    const text = currentBody;
    setRunRecipients(snapshot);
    setPhase('running');
    await sender.start(
      snapshot.map((r) => ({
        key: r.email,
        target: r.email,
        channel: 'Gmail',
        run: () =>
          callGmailSend({
            to: r.email,
            subject: renderTemplate(subj, r),
            body: renderTemplate(text, r),
          }),
      })),
    );
    setPhase('done');
  };

  const shown = runRecipients ?? recipients;
  const first = recipients[0];

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className={phase === 'running' ? '[&>button]:hidden max-w-2xl' : 'max-w-2xl'}>
        {phase === 'confirm' && (
          <>
            <DialogHeader>
              <DialogTitle>계정 삭제 안내 메일</DialogTitle>
              <DialogDescription>
                선택한 {recipients.length}명에게 저장된 안내 문구를 Gmail 로 보냅니다. 내 계정에서 발송됩니다.
              </DialogDescription>
            </DialogHeader>
            <PreviewList items={recipients} getKey={(r) => r.email} renderItem={(r) => `${r.name} (${r.email})`} unit="명" />

            {templatesQuery.isLoading && <p className="text-small text-fg-muted">저장된 문구를 불러오는 중...</p>}
            {templatesQuery.isError && (
              <Banner variant="warning" message={`저장된 문구를 불러오지 못했습니다 (${templatesQuery.error.message}). 기본 문구를 표시합니다.`} testId="deletion-notice-template-error" />
            )}
            {!templatesQuery.isLoading && !saved && !templatesQuery.isError && (
              <p className="text-micro text-fg-muted" data-testid="deletion-notice-default-hint">
                아직 저장된 문구가 없어 기본 문구를 보여줍니다. 수정 후 「문구 저장」을 누르면 다음부터 자동으로 불러옵니다.
              </p>
            )}

            <div className="space-y-3">
              <div>
                <label htmlFor="deletion-notice-subject" className="text-small text-fg-primary block mb-1">
                  제목
                </label>
                <input
                  id="deletion-notice-subject"
                  type="text"
                  value={currentSubject}
                  onChange={(e) => setSubject(e.target.value)}
                  data-testid="deletion-notice-subject"
                  className="w-full border border-border-subtle bg-canvas px-3 py-2 text-body text-fg-primary focus:outline-none focus:border-border-strong focus:ring-1 focus:ring-border-strong"
                />
              </div>
              <div>
                <label htmlFor="deletion-notice-body" className="text-small text-fg-primary block mb-1">
                  본문 <span className="text-micro text-fg-muted">(변수: {TEMPLATE_VARIABLES.join(' · ')})</span>
                </label>
                <textarea
                  id="deletion-notice-body"
                  value={currentBody}
                  onChange={(e) => setBody(e.target.value)}
                  rows={8}
                  data-testid="deletion-notice-body"
                  className="w-full border border-border-subtle bg-canvas px-3 py-2 text-body text-fg-primary focus:outline-none focus:border-border-strong focus:ring-1 focus:ring-border-strong"
                />
                <p className={`mt-1 text-small ${currentBody.length > MAIL_BODY_MAX ? 'text-state-danger' : 'text-fg-muted'}`}>
                  {currentBody.length} / {MAIL_BODY_MAX.toLocaleString()} 자
                </p>
              </div>
              {first && (
                <div className="border border-border-subtle bg-canvas p-3 space-y-1" data-testid="deletion-notice-preview">
                  <p className="text-micro text-fg-muted">미리보기 ({first.email})</p>
                  <p className="text-small font-semibold text-fg-primary">{renderTemplate(currentSubject, first)}</p>
                  <p className="text-small text-fg-primary whitespace-pre-wrap">{renderTemplate(currentBody, first)}</p>
                </div>
              )}
              <Banner variant="success" message={savedBanner} testId="deletion-notice-saved" />
              <Banner variant="error" message={upsert.error ? `문구 저장 실패: ${upsert.error.message}` : null} testId="deletion-notice-save-error" />
            </div>

            <DialogFooter>
              <Button variant="secondary" onClick={() => handleOpenChange(false)}>
                취소
              </Button>
              <Button
                variant="secondary"
                onClick={handleSave}
                disabled={!isDirty || subjectInvalid || bodyInvalid || upsert.isPending}
                data-testid="deletion-notice-save"
              >
                {upsert.isPending ? '저장 중...' : '문구 저장'}
              </Button>
              <Button
                onClick={handleSend}
                disabled={recipients.length === 0 || subjectInvalid || bodyInvalid || templatesQuery.isLoading}
                data-testid="deletion-notice-send"
              >
                {recipients.length}명에게 발송
              </Button>
            </DialogFooter>
          </>
        )}

        {phase === 'running' && (
          <>
            <SrOnlyDialogHeader title="삭제 안내 메일 발송 중" description="안내 메일을 보내고 있습니다." />
            <BulkProgress progress={sender.progress} total={shown.length} testId="deletion-notice-running" label="발송 중:" />
          </>
        )}

        {phase === 'done' && (
          <>
            <SrOnlyDialogHeader title="삭제 안내 메일 발송 완료" description="발송 작업이 끝났습니다." />
            {sender.results && <SendResults results={sender.results} testId="deletion-notice-done" />}
            <DialogFooter>
              <Button onClick={() => handleOpenChange(false)}>확인</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
