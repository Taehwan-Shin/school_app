import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import { Button } from "../../components/ui/button";
import { ConfirmCountInput } from "../../components/ConfirmCountInput";
import { callClassroomTransferOwnership } from "../../api/classroomTransferOwnership";
import {
  EMAIL_DOMAIN,
  EMAIL_LOCAL_PART_MAX,
  extractEmailLocalPart,
  normalizeSchoolEmailInput,
  previewSchoolEmail,
} from "../../lib/emailInput";

export interface BulkTransferClassroomOwnerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courses: { id: string; name?: string }[];
  onDone?: () => void;
}

type Phase = "confirm" | "running" | "done";

interface RowResult {
  courseId: string;
  courseName?: string;
  ok: boolean;
  message?: string;
  addedTeacherButPatchFailed?: boolean;
}

// v0.169: v0.164 의 local EMAIL_DOMAIN/EMAIL_RE 는 shared lib/emailInput 로 승격.
// EMAIL_DOMAIN 은 import 로 재사용 (라벨 · 에러 문구용).

export function BulkTransferClassroomOwnerDialog({
  open,
  onOpenChange,
  courses,
  onDone,
}: BulkTransferClassroomOwnerDialogProps) {
  const queryClient = useQueryClient();
  const [phase, setPhase] = useState<Phase>("confirm");
  const [newOwnerEmail, setNewOwnerEmail] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<RowResult[]>([]);
  // v0.164 (== v0.124 F99 대칭): confirm 시점 courses + newOwnerEmail snapshot.
  const [runCourses, setRunCourses] = useState<{ id: string; name?: string }[] | null>(null);
  const [runOwner, setRunOwner] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setPhase("confirm");
      setNewOwnerEmail("");
      setConfirmText("");
      setValidationError(null);
      setProgress(0);
      setResults([]);
      setRunCourses(null);
      setRunOwner(null);
    }
  }, [open]);

  const handleOpenChange = (newOpen: boolean) => {
    if (phase === "running") return;
    if (!newOpen && phase === "done") {
      onDone?.();
    }
    onOpenChange(newOpen);
  };

  const handleConfirm = async () => {
    setValidationError(null);
    const raw = newOwnerEmail.trim();
    if (!raw) return setValidationError("새 소유자 이메일을 입력해주세요.");
    // v0.169: shared helper — local-part 자동 부착 · lower-case canonical.
    const canonicalEmail = normalizeSchoolEmailInput(raw);
    if (!canonicalEmail)
      return setValidationError(
        `새 소유자 이메일 형식이 올바르지 않습니다. 아이디만 입력하거나 @${EMAIL_DOMAIN} 도메인의 전체 이메일을 입력해주세요.`,
      );

    // F99: snapshot 을 phase 전환과 동시에 확정.
    const coursesSnapshot = [...courses];
    setRunCourses(coursesSnapshot);
    setRunOwner(canonicalEmail);
    setPhase("running");

    const localResults: RowResult[] = [];
    for (let i = 0; i < coursesSnapshot.length; i++) {
      const c = coursesSnapshot[i];
      try {
        await callClassroomTransferOwnership({
          courseId: c.id,
          newOwnerEmail: canonicalEmail,
        });
        localResults.push({ courseId: c.id, courseName: c.name, ok: true });
      } catch (e) {
        const err = e as Error & { details?: { addedTeacherButPatchFailed?: boolean } };
        localResults.push({
          courseId: c.id,
          courseName: c.name,
          ok: false,
          message: err.message,
          addedTeacherButPatchFailed: err.details?.addedTeacherButPatchFailed,
        });
      }
      setProgress(i + 1);
    }
    setResults(localResults);
    setPhase("done");
    queryClient.invalidateQueries({ queryKey: ["classroom", "list"] });
  };

  const displayCourses = runCourses ?? courses;
  const displayOwner = runOwner ?? newOwnerEmail;
  const failures = results.filter((r) => !r.ok);
  const successes = results.filter((r) => r.ok);
  const confirmCountOk = confirmText.trim() === String(courses.length);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className={phase === "running" ? "[&>button]:hidden" : undefined}>
        {phase === "confirm" && (
          <>
            <DialogHeader>
              <DialogTitle>일괄 소유자 이관 확인</DialogTitle>
              <DialogDescription>
                선택한 {courses.length}개 클래스룸의 소유자를 새 이메일로 이관합니다.
                기존 소유자는 교사로 유지됩니다 (Google Classroom API 정책).
              </DialogDescription>
            </DialogHeader>

            <div>
              {/* v0.164 (== v0.124 F100 대칭): htmlFor/id 로 label 프로그램적 연결. */}
              <label
                htmlFor="bulk-transfer-owner-email"
                className="text-small text-fg-primary block mb-1"
              >
                새 소유자 <span className="text-fg-muted">(아이디 또는 @{EMAIL_DOMAIN})</span>
              </label>
              <input
                id="bulk-transfer-owner-email"
                type="text"
                value={newOwnerEmail}
                onChange={(e) => setNewOwnerEmail(e.target.value)}
                placeholder={`teacher 또는 teacher@${EMAIL_DOMAIN}`}
                data-testid="bulk-transfer-owner-email-input"
                className="w-full border border-border-subtle bg-canvas px-3 py-2 text-body text-fg-primary focus:outline-none focus:border-border-strong focus:ring-1 focus:ring-border-strong"
              />
              {(() => {
                // v0.169: 실시간 preview — local-part 입력 시 canonical 노출.
                const preview = previewSchoolEmail(newOwnerEmail);
                if (!preview || preview === newOwnerEmail.trim().toLowerCase()) return null;
                return (
                  <p
                    className="mt-1 text-micro text-fg-muted"
                    data-testid="bulk-transfer-owner-email-preview"
                  >
                    미리보기: <span className="font-mono">{preview}</span>
                  </p>
                );
              })()}
              {/* v0.191: local-part 64자 상한 카운터 (v0.181 CreateUser 대칭 · 통일 스타일). */}
              {(() => {
                const local = extractEmailLocalPart(newOwnerEmail.trim());
                if (local.length === 0) return null;
                return (
                  <p
                    className={`mt-1 text-small ${
                      local.length > EMAIL_LOCAL_PART_MAX
                        ? "text-state-danger"
                        : "text-fg-muted"
                    }`}
                    data-testid="bulk-transfer-owner-email-local-counter"
                  >
                    이메일 아이디 {local.length} / {EMAIL_LOCAL_PART_MAX} 자
                  </p>
                );
              })()}
            </div>

            <ul className="text-small text-fg-secondary max-h-40 overflow-y-auto space-y-1">
              {courses.slice(0, 5).map((c) => (
                <li key={c.id} className="font-mono">
                  {c.name ?? c.id}
                </li>
              ))}
              {courses.length > 5 && (
                <li className="text-fg-muted">... 외 {courses.length - 5}개</li>
              )}
            </ul>

            {/* v0.255: ConfirmCountInput 이식. */}
            <ConfirmCountInput
              expectedCount={courses.length}
              value={confirmText}
              onChange={setConfirmText}
              idPrefix="bulk-transfer-owner"
            />

            {validationError && (
              <p
                className="text-small text-state-danger"
                data-testid="bulk-transfer-owner-error"
              >
                {validationError}
              </p>
            )}

            <DialogFooter>
              <Button variant="secondary" onClick={() => onOpenChange(false)}>
                취소
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={!confirmCountOk || newOwnerEmail.trim() === ""}
                data-testid="bulk-transfer-owner-confirm-btn"
              >
                소유자 이관 실행
              </Button>
            </DialogFooter>
          </>
        )}

        {phase === "running" && (
          <>
            <DialogHeader className="sr-only">
              <DialogTitle>일괄 소유자 이관 진행 중</DialogTitle>
              <DialogDescription>클래스룸 소유자를 이관하고 있습니다.</DialogDescription>
            </DialogHeader>
            <div className="py-8 text-center space-y-3" data-testid="bulk-transfer-owner-running">
              <div className="text-body text-fg-primary">
                진행 중 (「{displayOwner}」 로 이관):{" "}
                <strong className="font-mono">{progress}</strong> /{" "}
                <strong className="font-mono">{displayCourses.length}</strong>
              </div>
              <div className="w-full bg-canvas h-2 border border-border-subtle">
                <div
                  className="bg-fg-primary h-full transition-all"
                  style={{
                    width: `${
                      displayCourses.length > 0
                        ? (progress / displayCourses.length) * 100
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>
          </>
        )}

        {phase === "done" && (
          <>
            <DialogHeader className="sr-only">
              <DialogTitle>일괄 소유자 이관 완료</DialogTitle>
              <DialogDescription>일괄 소유자 이관 작업이 완료되었습니다.</DialogDescription>
            </DialogHeader>
            <div data-testid="bulk-transfer-owner-done" className="space-y-3">
              <p className="text-body text-fg-primary">
                「{displayOwner}」 로 이관 완료:{" "}
                <strong className="text-state-success font-mono">{successes.length}</strong>
                개 성공
                {failures.length > 0 && (
                  <>
                    {" "}
                    ·{" "}
                    <strong className="text-state-danger font-mono">{failures.length}</strong>
                    개 실패
                  </>
                )}
              </p>
              {failures.length > 0 && (
                <ul
                  className="text-small text-state-danger space-y-1 max-h-40 overflow-y-auto"
                  data-testid="bulk-transfer-owner-failures"
                >
                  {failures.map((f) => (
                    <li key={f.courseId}>
                      <span className="font-mono">{f.courseName ?? f.courseId}</span>:{" "}
                      {f.message}
                      {f.addedTeacherButPatchFailed && (
                        <span className="ml-1 text-state-warning">
                          {" "}
                          (교사가 남아 있을 수 있음 — 수동 정리 필요)
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              <DialogFooter>
                <Button onClick={() => handleOpenChange(false)}>확인</Button>
              </DialogFooter>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
