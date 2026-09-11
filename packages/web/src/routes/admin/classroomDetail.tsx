import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { userHasCap } from '@school-app/shared';
import { useAuth } from '../../lib/auth';
import { AppShell } from '../../components/shell/AppShell';
import { useClassroomList } from '../../api/classroomList';
import { CourseMembersPanel } from './CourseMembersPanel';
import {
  ArchiveClassroomDialog,
  type ArchiveClassroomTarget,
} from './ArchiveClassroomDialog';
import {
  DeleteClassroomDialog,
  type DeleteClassroomTarget,
} from './DeleteClassroomDialog';
import {
  TransferClassroomOwnerDialog,
  type TransferClassroomOwnerTarget,
} from './TransferClassroomOwnerDialog';
import { translateCourseState } from './ClassroomTable';

export function ClassroomDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const courseId = decodeURIComponent(id);
  const navigate = useNavigate();
  const { role } = useAuth();
  const canTransferOwner = userHasCap(role, 'classroom.transfer_owner');
  const { data, isLoading, isError, error } = useClassroomList();
  const course = data?.courses?.find((c) => c.id === courseId);

  const [archiveTarget, setArchiveTarget] = useState<ArchiveClassroomTarget | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteClassroomTarget | null>(null);
  const [transferTarget, setTransferTarget] = useState<TransferClassroomOwnerTarget | null>(null);
  // v0.117b F81: 멤버 add/delete pending 중 코스 단위 mutation 을 잠근다.
  // 반대로 코스 mutation dialog 가 열려 있을 때 멤버 조작도 잠글 수 있으나 dialog
  // 자체가 modal 이라 backdrop 이 클릭을 차단 — 여기서는 편도만 처리.
  const [membersPending, setMembersPending] = useState(false);

  const canManage = course && (course.courseState === 'ACTIVE' || course.courseState === 'ARCHIVED');
  const isActive = course?.courseState === 'ACTIVE';
  // audit 링크 target 은 `courses/<id>` — 서버 writeAudit 이 사용하는 target 형식과 정확 일치.
  const auditTarget = `courses/${courseId}`;

  return (
    <AppShell role={role} pageTitle={`클래스룸: ${course?.name || courseId}`}>
      <div className="space-y-6">
        <button
          type="button"
          onClick={() => navigate('/admin/classrooms')}
          data-testid="classroom-detail-back"
          className="text-fg-secondary hover:text-fg-primary text-small cursor-pointer"
        >
          ← 클래스룸 목록
        </button>

        <section
          className="bg-elevated p-8 border border-border-subtle space-y-4"
          data-testid="classroom-detail-info"
        >
          <div className="flex justify-between items-start gap-4">
            <div>
              <h2 className="text-h2 font-semibold text-fg-primary">코스 정보</h2>
              <p className="text-small text-fg-secondary font-mono mt-1">{courseId}</p>
            </div>
            {course && (
              <div className="flex items-center gap-3 flex-wrap justify-end">
                {canManage && (
                  <button
                    type="button"
                    onClick={() =>
                      setArchiveTarget({
                        id: course.id,
                        name: course.name,
                        currentState: course.courseState || '',
                      })
                    }
                    disabled={membersPending}
                    data-testid={`classroom-detail-archive-btn`}
                    className="text-fg-primary underline decoration-transparent hover:decoration-fg-primary text-small transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-strong disabled:opacity-50 disabled:cursor-not-allowed disabled:no-underline"
                  >
                    {isActive ? '아카이브' : '복구'}
                  </button>
                )}
                {canTransferOwner && isActive && (
                  <>
                    <span className="text-fg-muted text-small" aria-hidden="true">·</span>
                    <button
                      type="button"
                      onClick={() =>
                        setTransferTarget({
                          id: course.id,
                          name: course.name,
                          currentOwnerId: course.ownerId,
                        })
                      }
                      disabled={membersPending}
                      data-testid={`classroom-detail-transfer-owner-btn`}
                      title={
                        membersPending
                          ? '멤버 변경이 진행 중입니다.'
                          : '소유자 이관 (admin/super_admin 전용)'
                      }
                      className="text-fg-primary underline decoration-transparent hover:decoration-fg-primary text-small transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-strong disabled:opacity-50 disabled:cursor-not-allowed disabled:no-underline"
                    >
                      소유자 이관
                    </button>
                  </>
                )}
                <span className="text-fg-muted text-small" aria-hidden="true">·</span>
                <button
                  type="button"
                  onClick={() => setDeleteTarget({ id: course.id, name: course.name })}
                  disabled={membersPending}
                  data-testid={`classroom-detail-delete-btn`}
                  className="text-state-danger underline decoration-transparent hover:decoration-state-danger text-small transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-strong disabled:opacity-50 disabled:cursor-not-allowed disabled:no-underline"
                >
                  삭제
                </button>
              </div>
            )}
          </div>

          {isLoading && (
            <p className="text-small text-fg-secondary" data-testid="classroom-detail-loading">
              불러오는 중...
            </p>
          )}
          {isError && (
            <div
              className="border border-state-danger p-4 text-small text-state-danger"
              data-testid="classroom-detail-error"
            >
              코스 정보를 불러오지 못했습니다: {error?.message || '알 수 없는 오류'}
            </div>
          )}
          {!isLoading && !isError && !course && (
            <p
              className="text-small text-fg-secondary"
              data-testid="classroom-detail-not-found"
            >
              코스를 찾을 수 없습니다: <span className="font-mono">{courseId}</span>
            </p>
          )}

          {course && (
            <dl className="grid grid-cols-2 gap-x-8 gap-y-3">
              <div>
                <dt className="text-micro uppercase tracking-wide text-fg-secondary">이름</dt>
                <dd className="text-body text-fg-primary">{course.name || '-'}</dd>
              </div>
              <div>
                <dt className="text-micro uppercase tracking-wide text-fg-secondary">섹션</dt>
                <dd className="text-body text-fg-primary">{course.section || '-'}</dd>
              </div>
              <div>
                <dt className="text-micro uppercase tracking-wide text-fg-secondary">상태</dt>
                <dd className="text-body text-fg-primary">
                  {translateCourseState(course.courseState)}
                </dd>
              </div>
              <div>
                <dt className="text-micro uppercase tracking-wide text-fg-secondary">소유자 ID</dt>
                <dd className="text-body font-mono text-fg-primary" data-testid="classroom-detail-owner-id">
                  {course.ownerId || '-'}
                </dd>
              </div>
              {course.description && (
                <div className="col-span-2">
                  <dt className="text-micro uppercase tracking-wide text-fg-secondary">설명</dt>
                  <dd className="text-body text-fg-secondary whitespace-pre-wrap">
                    {course.description}
                  </dd>
                </div>
              )}
              {course.alternateLink && (
                <div className="col-span-2">
                  <dt className="text-micro uppercase tracking-wide text-fg-secondary">Classroom 링크</dt>
                  <dd className="text-body">
                    <a
                      href={course.alternateLink}
                      target="_blank"
                      rel="noreferrer"
                      data-testid="classroom-detail-link"
                      className="text-fg-primary underline decoration-transparent hover:decoration-fg-primary transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-strong"
                    >
                      Google Classroom 에서 열기
                    </a>
                  </dd>
                </div>
              )}
            </dl>
          )}
        </section>

        <section className="bg-elevated p-8 border border-border-subtle space-y-4">
          <h2 className="text-h2 font-semibold text-fg-primary">멤버 관리</h2>
          <p className="text-small text-fg-secondary">교사·학생 명단을 확인하고 관리합니다.</p>
          <CourseMembersPanel
            courseId={course ? course.id : null}
            courseName={course?.name}
            onPendingChange={setMembersPending}
          />
        </section>

        {role === 'super_admin' && (
          <section className="bg-elevated p-8 border border-border-subtle space-y-3">
            <h2 className="text-h2 font-semibold text-fg-primary">감사 이력</h2>
            <p className="text-small text-fg-secondary">
              이 코스를 대상으로 발생한 감사 로그를 확인할 수 있습니다.
            </p>
            <Link
              to={`/super_admin/audit?target=${encodeURIComponent(auditTarget)}`}
              data-testid="classroom-detail-audit-link"
              className="text-fg-primary underline decoration-transparent hover:decoration-fg-primary text-small transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-strong"
            >
              감사 로그에서 이 코스 검색 →
            </Link>
          </section>
        )}
      </div>

      <ArchiveClassroomDialog
        open={!!archiveTarget}
        onOpenChange={(o) => !o && setArchiveTarget(null)}
        target={archiveTarget}
      />
      <DeleteClassroomDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        target={deleteTarget}
        onSuccess={() => navigate('/admin/classrooms')}
      />
      {transferTarget && (
        <TransferClassroomOwnerDialog
          open={true}
          onOpenChange={(o) => !o && setTransferTarget(null)}
          target={transferTarget}
        />
      )}
    </AppShell>
  );
}
