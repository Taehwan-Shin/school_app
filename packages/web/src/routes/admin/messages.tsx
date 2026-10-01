import { useMemo, useState } from 'react';
import { useAuth } from '../../lib/auth';
import { AppShell } from '../../components/shell/AppShell';
import { Button } from '../../components/ui/button';
import { Banner } from '../../components/Banner';
import { BulkProgress } from '../../components/BulkProgress';
import { SendResults } from '../../components/SendResults';
import { useSequentialSend, type SendJob } from '../../lib/useSequentialSend';
import {
  CHAT_TEXT_MAX,
  MAIL_BODY_MAX,
  SUBJECT_MAX,
  buildSpaceMessage,
  parseEmailList,
} from '../../lib/messageTemplate';
import {
  callChatDmSend,
  callChatSpaceSend,
  callGmailSend,
  useDeleteMessageTemplate,
  useMessageTemplates,
  useUpsertMessageTemplate,
} from '../../api/messages';
import { useChatList } from '../../api/chatList';

// v0.322: 메시지 발송 (원본 「메신저」 Apps Script 포팅 · bliss00 요청 2026-10-01).
// - 일괄 발송: 같은 메시지 → 여러 학생 (챗 DM · Gmail 선택)      (원본 sendMessages)
// - 개별 발송: 학생마다 다른 메시지 (챗 DM · Gmail)               (원본 indSendAllChecked)
// - 스페이스 발송: 같은 메시지 → 여러 챗 스페이스                  (원본 sendCheckedSpacesMessage)
// 모두 로그인한 선생님 본인 계정으로 발송 (서버 callable 이 사용자 OAuth 사용).

type Tab = 'bulk' | 'individual' | 'space';

const INPUT =
  'w-full border border-border-subtle bg-canvas px-3 py-2 text-body text-fg-primary focus:outline-none focus:border-border-strong focus:ring-1 focus:ring-border-strong disabled:opacity-60';

const TABS: { id: Tab; label: string }[] = [
  { id: 'bulk', label: '일괄 발송' },
  { id: 'individual', label: '개별 발송' },
  { id: 'space', label: '스페이스 발송' },
];

export function AdminMessagesPage() {
  const { role } = useAuth();
  const [tab, setTab] = useState<Tab>('bulk');
  const sender = useSequentialSend();

  return (
    <AppShell role={role} pageTitle="메시지 발송">
      <section className="bg-elevated p-8 border border-border-subtle space-y-6">
        <div>
          <h2 className="text-h2 font-semibold text-fg-primary">메시지 발송</h2>
          <p className="text-small text-fg-secondary mt-1">
            구글챗 DM · Gmail · 챗 스페이스로 메시지를 보냅니다. 내 계정에서 발송되며, 발송 기록은 감사 로그에 남습니다 (본문 제외).
          </p>
        </div>
        <div className="flex gap-2 border-b border-border-subtle" role="tablist" aria-label="발송 방식">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              disabled={sender.running}
              onClick={() => {
                setTab(t.id);
                sender.reset();
              }}
              data-testid={`messages-tab-${t.id}`}
              className={`px-4 py-2 text-small -mb-px border-b-2 ${
                tab === t.id
                  ? 'border-fg-primary text-fg-primary font-semibold'
                  : 'border-transparent text-fg-secondary hover:text-fg-primary'
              } disabled:opacity-50`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'bulk' && <BulkTab sender={sender} />}
        {tab === 'individual' && <IndividualTab sender={sender} />}
        {tab === 'space' && <SpaceTab sender={sender} />}

        {sender.running && (
          <BulkProgress progress={sender.progress} total={sender.total} testId="messages-running" label="발송 중:" />
        )}
        {!sender.running && sender.results && <SendResults results={sender.results} testId="messages-done" />}
      </section>
    </AppShell>
  );
}

type Sender = ReturnType<typeof useSequentialSend>;

function ChannelToggles({
  chat,
  mail,
  onChat,
  onMail,
  disabled,
  prefix,
}: {
  chat: boolean;
  mail: boolean;
  onChat: (v: boolean) => void;
  onMail: (v: boolean) => void;
  disabled: boolean;
  prefix: string;
}) {
  return (
    <fieldset className="flex items-center gap-4" disabled={disabled}>
      <legend className="text-small text-fg-primary mb-1">보낼 곳</legend>
      <label className="flex items-center gap-2 text-small text-fg-primary">
        <input type="checkbox" checked={chat} onChange={(e) => onChat(e.target.checked)} data-testid={`${prefix}-channel-chat`} />
        구글챗 DM
      </label>
      <label className="flex items-center gap-2 text-small text-fg-primary">
        <input type="checkbox" checked={mail} onChange={(e) => onMail(e.target.checked)} data-testid={`${prefix}-channel-mail`} />
        Gmail
      </label>
    </fieldset>
  );
}

function confirmSend(summary: string): boolean {
  return window.confirm(`${summary}\n\n정말 발송하시겠습니까? 발송 후에는 되돌릴 수 없습니다.`);
}

// ─── 일괄 발송 ───────────────────────────────────────────────
function BulkTab({ sender }: { sender: Sender }) {
  const [recipientsText, setRecipientsText] = useState('');
  const [chat, setChat] = useState(true);
  const [mail, setMail] = useState(false);
  const [subject, setSubject] = useState('선생님 알림');
  const [message, setMessage] = useState('');
  const { valid, invalid } = useMemo(() => parseEmailList(recipientsText), [recipientsText]);

  const tooLong = (chat && message.trim().length > CHAT_TEXT_MAX) || message.length > MAIL_BODY_MAX;
  const subjectBad = mail && (!subject.trim() || subject.length > SUBJECT_MAX || /[\r\n]/.test(subject));
  const canSend = valid.length > 0 && (chat || mail) && message.trim() && !tooLong && !subjectBad && !sender.running;

  const handleSend = () => {
    const lines = [];
    if (chat) lines.push(`구글챗 DM ${valid.length}명`);
    if (mail) lines.push(`Gmail ${valid.length}명`);
    if (!confirmSend(lines.join(' · '))) return;
    const text = message.trim();
    const jobs: SendJob[] = [];
    if (chat) {
      for (const email of valid) {
        jobs.push({ key: `chat:${email}`, target: email, channel: '챗 DM', run: () => callChatDmSend({ email, text }) });
      }
    }
    if (mail) {
      const subj = subject.trim();
      for (const email of valid) {
        jobs.push({ key: `mail:${email}`, target: email, channel: 'Gmail', run: () => callGmailSend({ to: email, subject: subj, body: text }) });
      }
    }
    void sender.start(jobs);
  };

  return (
    <div className="space-y-4" data-testid="messages-bulk">
      <TemplatePicker
        disabled={sender.running}
        subject={subject}
        body={message}
        onLoad={(t) => {
          if (t.subject) setSubject(t.subject);
          setMessage(t.body);
        }}
      />
      <div>
        <label htmlFor="messages-bulk-recipients" className="text-small text-fg-primary block mb-1">
          받는 학생 이메일 <span className="text-micro text-fg-muted">(줄바꿈 · 쉼표로 구분 · 시트에서 열 복사·붙여넣기 가능)</span>
        </label>
        <textarea
          id="messages-bulk-recipients"
          rows={5}
          value={recipientsText}
          onChange={(e) => setRecipientsText(e.target.value)}
          disabled={sender.running}
          placeholder={'s20301@cam.hs.kr\ns20302@cam.hs.kr'}
          data-testid="messages-bulk-recipients"
          className={INPUT}
        />
        <p className="mt-1 text-small text-fg-muted" data-testid="messages-bulk-count">
          유효 {valid.length}명
          {invalid.length > 0 && (
            <span className="text-state-danger"> · 형식 오류 {invalid.length}건 ({invalid.slice(0, 3).join(', ')}{invalid.length > 3 ? ' …' : ''})</span>
          )}
        </p>
      </div>
      <ChannelToggles chat={chat} mail={mail} onChat={setChat} onMail={setMail} disabled={sender.running} prefix="messages-bulk" />
      {mail && (
        <div>
          <label htmlFor="messages-bulk-subject" className="text-small text-fg-primary block mb-1">
            메일 제목
          </label>
          <input id="messages-bulk-subject" type="text" value={subject} onChange={(e) => setSubject(e.target.value)} disabled={sender.running} data-testid="messages-bulk-subject" className={INPUT} />
        </div>
      )}
      <div>
        <label htmlFor="messages-bulk-message" className="text-small text-fg-primary block mb-1">
          메시지
        </label>
        <textarea id="messages-bulk-message" rows={8} value={message} onChange={(e) => setMessage(e.target.value)} disabled={sender.running} data-testid="messages-bulk-message" className={INPUT} />
        <p className={`mt-1 text-small ${tooLong ? 'text-state-danger' : 'text-fg-muted'}`}>
          {message.trim().length} 자{chat ? ` (챗 최대 ${CHAT_TEXT_MAX.toLocaleString()}자)` : ''}
        </p>
      </div>
      <Button onClick={handleSend} disabled={!canSend} data-testid="messages-bulk-send">
        {valid.length}명에게 발송
      </Button>
    </div>
  );
}

// ─── 개별 발송 ───────────────────────────────────────────────
interface Row {
  id: number;
  email: string;
  message: string;
}

let rowSeq = 1;
const newRow = (email = '', message = ''): Row => ({ id: rowSeq++, email, message });

/** 「이메일<TAB>메시지」 줄 단위 붙여넣기 (구글시트 두 열 복사). */
export function parseIndividualPaste(text: string): { email: string; message: string }[] {
  return text
    .split(/\r?\n/)
    .map((line) => {
      const [email, ...rest] = line.split('\t');
      return { email: (email ?? '').trim(), message: rest.join('\t').trim() };
    })
    .filter((r) => r.email || r.message);
}

const EMAIL_RE = /^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$/;

function IndividualTab({ sender }: { sender: Sender }) {
  const [rows, setRows] = useState<Row[]>(() => [newRow(), newRow(), newRow()]);
  const [chat, setChat] = useState(true);
  const [mail, setMail] = useState(false);
  const [subject, setSubject] = useState('선생님 알림');
  const [pasteText, setPasteText] = useState('');

  const ready = rows.filter((r) => EMAIL_RE.test(r.email.trim()) && r.message.trim());
  const badRows = rows.filter((r) => (r.email.trim() || r.message.trim()) && !(EMAIL_RE.test(r.email.trim()) && r.message.trim()));
  const tooLong = ready.some((r) => (chat && r.message.trim().length > CHAT_TEXT_MAX) || r.message.length > MAIL_BODY_MAX);
  const subjectBad = mail && (!subject.trim() || subject.length > SUBJECT_MAX || /[\r\n]/.test(subject));
  const canSend = ready.length > 0 && (chat || mail) && !tooLong && !subjectBad && !sender.running;

  const update = (id: number, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const handleSend = () => {
    const lines = [];
    if (chat) lines.push(`구글챗 DM ${ready.length}명`);
    if (mail) lines.push(`Gmail ${ready.length}명`);
    if (!confirmSend(`개별 메시지 · ${lines.join(' · ')}`)) return;
    const subj = subject.trim();
    const jobs: SendJob[] = [];
    for (const r of ready) {
      const email = r.email.trim().toLowerCase();
      const text = r.message.trim();
      if (chat) jobs.push({ key: `chat:${r.id}`, target: email, channel: '챗 DM', run: () => callChatDmSend({ email, text }) });
      if (mail) jobs.push({ key: `mail:${r.id}`, target: email, channel: 'Gmail', run: () => callGmailSend({ to: email, subject: subj, body: text }) });
    }
    void sender.start(jobs);
  };

  return (
    <div className="space-y-4" data-testid="messages-individual">
      <details className="border border-border-subtle p-3">
        <summary className="cursor-pointer text-small text-fg-primary">시트에서 붙여넣기 (이메일 · 메시지 두 열)</summary>
        <div className="mt-2 space-y-2">
          <textarea
            rows={4}
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            aria-label="이메일과 메시지 두 열 붙여넣기"
            data-testid="messages-individual-paste"
            placeholder={'s20301@cam.hs.kr\t수행평가 제출을 확인해 주세요.'}
            className={INPUT}
          />
          <Button
            variant="secondary"
            size="sm"
            disabled={!pasteText.trim() || sender.running}
            onClick={() => {
              const parsed = parseIndividualPaste(pasteText);
              const kept = rows.filter((r) => r.email.trim() || r.message.trim());
              setRows([...kept, ...parsed.map((p) => newRow(p.email, p.message))]);
              setPasteText('');
            }}
            data-testid="messages-individual-paste-apply"
          >
            표에 추가
          </Button>
        </div>
      </details>

      <div className="space-y-2" data-testid="messages-individual-rows">
        {rows.map((r, i) => (
          <div key={r.id} className="grid grid-cols-[minmax(0,14rem)_minmax(0,1fr)_auto] gap-2 items-start">
            <input
              type="email"
              value={r.email}
              onChange={(e) => update(r.id, { email: e.target.value })}
              placeholder="학생 이메일"
              aria-label={`${i + 1}행 이메일`}
              disabled={sender.running}
              className={INPUT}
            />
            <textarea
              rows={2}
              value={r.message}
              onChange={(e) => update(r.id, { message: e.target.value })}
              placeholder="이 학생에게 보낼 메시지"
              aria-label={`${i + 1}행 메시지`}
              disabled={sender.running}
              className={INPUT}
            />
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setRows((rs) => (rs.length > 1 ? rs.filter((x) => x.id !== r.id) : [newRow()]))}
              disabled={sender.running}
              aria-label={`${i + 1}행 삭제`}
            >
              삭제
            </Button>
          </div>
        ))}
        <Button variant="secondary" size="sm" onClick={() => setRows((rs) => [...rs, newRow()])} disabled={sender.running} data-testid="messages-individual-add-row">
          + 행 추가
        </Button>
        {badRows.length > 0 && (
          <p className="text-small text-state-danger">이메일 형식이 틀리거나 메시지가 빈 행 {badRows.length}개는 발송에서 제외됩니다.</p>
        )}
      </div>

      <ChannelToggles chat={chat} mail={mail} onChat={setChat} onMail={setMail} disabled={sender.running} prefix="messages-individual" />
      {mail && (
        <div>
          <label htmlFor="messages-individual-subject" className="text-small text-fg-primary block mb-1">
            메일 제목 (공통)
          </label>
          <input id="messages-individual-subject" type="text" value={subject} onChange={(e) => setSubject(e.target.value)} disabled={sender.running} className={INPUT} />
        </div>
      )}
      <Button onClick={handleSend} disabled={!canSend} data-testid="messages-individual-send">
        {ready.length}명에게 개별 발송
      </Button>
    </div>
  );
}

// ─── 스페이스 발송 ───────────────────────────────────────────
function SpaceTab({ sender }: { sender: Sender }) {
  const chatList = useChatList();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState('');
  const [senderName, setSenderName] = useState('');
  const [link, setLink] = useState('');
  const spaces = (chatList.data?.spaces ?? []).filter((s) => s.spaceType !== 'DIRECT_MESSAGE');
  const finalMessage = buildSpaceMessage(message, senderName, link);
  const tooLong = finalMessage.length > CHAT_TEXT_MAX;
  const canSend = selected.size > 0 && message.trim() && !tooLong && !sender.running;

  const handleSend = () => {
    if (!confirmSend(`챗 스페이스 ${selected.size}곳`)) return;
    const names = new Map(spaces.map((s) => [s.name, s.displayName || s.name]));
    void sender.start(
      Array.from(selected).map((spaceName) => ({
        key: spaceName,
        target: names.get(spaceName) ?? spaceName,
        channel: '챗 스페이스',
        run: () => callChatSpaceSend({ spaceName, text: finalMessage }),
      })),
    );
  };

  return (
    <div className="space-y-4" data-testid="messages-space">
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-small text-fg-primary">보낼 스페이스 ({selected.size} / {spaces.length})</span>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => setSelected(new Set(spaces.map((s) => s.name)))} disabled={sender.running || spaces.length === 0}>
              전체 선택
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setSelected(new Set())} disabled={sender.running || selected.size === 0}>
              전체 해제
            </Button>
          </div>
        </div>
        {chatList.isLoading && <p className="text-small text-fg-muted">스페이스 목록을 불러오는 중...</p>}
        <Banner variant="error" message={chatList.isError ? `스페이스 목록 로드 실패: ${chatList.error.message}` : null} testId="messages-space-list-error" />
        <div className="max-h-64 overflow-y-auto border border-border-subtle p-2 space-y-1" data-testid="messages-space-list">
          {spaces.map((s) => (
            <label key={s.name} className="flex items-center gap-2 text-small text-fg-primary px-2 py-1 hover:bg-surface cursor-pointer">
              <input
                type="checkbox"
                checked={selected.has(s.name)}
                disabled={sender.running}
                onChange={() =>
                  setSelected((prev) => {
                    const next = new Set(prev);
                    if (next.has(s.name)) next.delete(s.name);
                    else next.add(s.name);
                    return next;
                  })
                }
              />
              {s.displayName || s.name}
            </label>
          ))}
          {!chatList.isLoading && spaces.length === 0 && <p className="text-small text-fg-muted px-2">내가 속한 스페이스가 없습니다.</p>}
        </div>
      </div>
      <div>
        <label htmlFor="messages-space-message" className="text-small text-fg-primary block mb-1">
          메시지
        </label>
        <textarea id="messages-space-message" rows={6} value={message} onChange={(e) => setMessage(e.target.value)} disabled={sender.running} data-testid="messages-space-message" className={INPUT} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label htmlFor="messages-space-sender" className="text-small text-fg-primary block mb-1">
            보내는 사람 (선택)
          </label>
          <input id="messages-space-sender" type="text" value={senderName} onChange={(e) => setSenderName(e.target.value)} disabled={sender.running} placeholder="예: 3학년부" className={INPUT} />
        </div>
        <div>
          <label htmlFor="messages-space-link" className="text-small text-fg-primary block mb-1">
            첨부 링크 (선택)
          </label>
          <input id="messages-space-link" type="url" value={link} onChange={(e) => setLink(e.target.value)} disabled={sender.running} placeholder="https://drive.google.com/..." className={INPUT} />
        </div>
      </div>
      {message.trim() && (
        <div className="border border-border-subtle bg-canvas p-3" data-testid="messages-space-preview">
          <p className="text-micro text-fg-muted mb-1">미리보기</p>
          <p className="text-small text-fg-primary whitespace-pre-wrap">{finalMessage}</p>
          {tooLong && <p className="text-small text-state-danger mt-1">챗 메시지는 최대 {CHAT_TEXT_MAX.toLocaleString()}자입니다.</p>}
        </div>
      )}
      <Button onClick={handleSend} disabled={!canSend} data-testid="messages-space-send">
        {selected.size}곳에 발송
      </Button>
    </div>
  );
}

// ─── 문구 템플릿 (일괄 발송) ──────────────────────────────────
function TemplatePicker({
  disabled,
  subject,
  body,
  onLoad,
}: {
  disabled: boolean;
  subject: string;
  body: string;
  onLoad: (t: { subject: string; body: string }) => void;
}) {
  const templatesQuery = useMessageTemplates();
  const upsert = useUpsertMessageTemplate();
  const del = useDeleteMessageTemplate();
  const [selectedId, setSelectedId] = useState('');
  const [banner, setBanner] = useState<string | null>(null);
  const templates = templatesQuery.data?.templates ?? [];

  const handleSaveAs = async () => {
    const name = window.prompt('저장할 문구 이름', templates.find((t) => t.id === selectedId)?.name ?? '');
    if (!name?.trim()) return;
    // 이름 → id (같은 이름은 덮어쓰기). 한글 이름은 해시 대신 시각 기반 id.
    const existing = templates.find((t) => t.name === name.trim());
    const id = existing?.id ?? `t_${Date.now().toString(36)}`;
    try {
      await upsert.mutateAsync({ id, name: name.trim(), subject: subject.trim(), body });
      setSelectedId(id);
      setBanner(`「${name.trim()}」 문구를 저장했습니다.`);
    } catch {
      /* upsert.error 배너 */
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2" data-testid="messages-template-picker">
      <label htmlFor="messages-template-select" className="text-small text-fg-primary">
        저장된 문구
      </label>
      <select
        id="messages-template-select"
        value={selectedId}
        disabled={disabled || templates.length === 0}
        onChange={(e) => {
          const id = e.target.value;
          setSelectedId(id);
          const t = templates.find((x) => x.id === id);
          if (t) onLoad(t);
        }}
        data-testid="messages-template-select"
        className="border border-border-subtle bg-canvas px-3 py-2 text-small text-fg-primary"
      >
        <option value="">{templatesQuery.isLoading ? '불러오는 중...' : templates.length ? '선택하면 불러옵니다' : '저장된 문구 없음'}</option>
        {templates.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
      <Button variant="secondary" size="sm" onClick={handleSaveAs} disabled={disabled || !body.trim() || upsert.isPending} data-testid="messages-template-save">
        현재 문구 저장
      </Button>
      <Button
        variant="secondary"
        size="sm"
        disabled={disabled || !selectedId || del.isPending}
        onClick={async () => {
          const t = templates.find((x) => x.id === selectedId);
          if (!t || !window.confirm(`「${t.name}」 문구를 삭제할까요?`)) return;
          try {
            await del.mutateAsync({ id: t.id });
            setSelectedId('');
            setBanner(`「${t.name}」 문구를 삭제했습니다.`);
          } catch {
            /* del.error 배너 */
          }
        }}
        data-testid="messages-template-delete"
      >
        삭제
      </Button>
      <div className="basis-full">
        <Banner variant="success" message={banner} testId="messages-template-banner" />
        <Banner
          variant="error"
          message={
            templatesQuery.isError
              ? `문구 목록 로드 실패: ${templatesQuery.error.message}`
              : upsert.error
                ? `저장 실패: ${upsert.error.message}`
                : del.error
                  ? `삭제 실패: ${del.error.message}`
                  : null
          }
          testId="messages-template-error"
        />
      </div>
    </div>
  );
}
