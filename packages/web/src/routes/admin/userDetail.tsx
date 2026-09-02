import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { AppShell } from '../../components/shell/AppShell';
import { useUsersList } from '../../api/usersList';
import { UserAuditTrail } from './UserAuditTrail';
import { UserGroups } from './UserGroups';
import { EditUserDialog, type EditUserTarget } from './EditUserDialog';
import { SuspendUserDialog, type SuspendUserTarget } from './SuspendUserDialog';
import { ResetPasswordDialog, type ResetPasswordTarget } from './ResetPasswordDialog';
import { DeleteUserDialog, type DeleteUserTarget } from './DeleteUserDialog';

export function UserDetailPage() {
  const { email = '' } = useParams<{ email: string }>();
  const userEmail = decodeURIComponent(email);
  const navigate = useNavigate();
  const { user: currentAuthUser, role } = useAuth();
  const { data, isLoading, isError } = useUsersList();

  const [editTarget, setEditTarget] = useState<EditUserTarget | null>(null);
  const [suspendTarget, setSuspendTarget] = useState<SuspendUserTarget | null>(null);
  const [resetTarget, setResetTarget] = useState<ResetPasswordTarget | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteUserTarget | null>(null);

  const user = data?.users?.find((u) => u.email.toLowerCase() === userEmail.toLowerCase());

  const isSelf =
    Boolean(currentAuthUser?.email) &&
    user?.email.toLowerCase() === currentAuthUser?.email?.toLowerCase();

  return (
    <AppShell role={role} pageTitle={`사용자: ${userEmail}`}>
      <div className="space-y-6">
        <button
          type="button"
          onClick={() => navigate('/admin')}
          className="text-fg-secondary hover:text-fg-primary text-small cursor-pointer"
        >
          ← 계정 목록
        </button>

        {/* 정보 카드 */}
        <section className="bg-elevated p-8 border border-border-subtle space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-h2 font-semibold text-fg-primary">사용자 정보</h2>
            {user && (
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() =>
                    setEditTarget({
                      email: user.email,
                      firstName: user.firstName,
                      lastName: user.lastName,
                      orgUnitPath: user.orgUnitPath || '/',
                    })
                  }
                  data-testid={`user-detail-edit-${user.email}`}
                  className="text-fg-primary underline decoration-transparent hover:decoration-fg-primary text-small transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-strong focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
                >
                  편집
                </button>
                <span className="text-fg-muted text-small" aria-hidden="true">·</span>
                <button
                  type="button"
                  disabled={isSelf}
                  title={isSelf ? '자기 계정 비밀번호는 여기서 재설정할 수 없습니다' : '비밀번호 재설정'}
                  onClick={() =>
                    setResetTarget({
                      email: user.email,
                      firstName: user.firstName,
                      lastName: user.lastName,
                    })
                  }
                  data-testid={`user-detail-reset-${user.email}`}
                  className={
                    isSelf
                      ? 'text-fg-muted cursor-not-allowed no-underline text-small focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-strong focus-visible:ring-offset-2 focus-visible:ring-offset-canvas'
                      : 'text-fg-primary underline decoration-transparent hover:decoration-fg-primary text-small transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-strong focus-visible:ring-offset-2 focus-visible:ring-offset-canvas'
                  }
                >
                  비밀번호
                </button>
                <span className="text-fg-muted text-small" aria-hidden="true">·</span>
                <button
                  type="button"
                  disabled={isSelf}
                  title={isSelf ? '자기 계정은 정지·복구할 수 없습니다' : (user.isSuspended ? '계정 복구' : '계정 정지')}
                  onClick={() =>
                    setSuspendTarget({
                      email: user.email,
                      firstName: user.firstName,
                      lastName: user.lastName,
                      isSuspended: user.isSuspended,
                    })
                  }
                  data-testid={`user-detail-suspend-${user.email}`}
                  className={
                    isSelf
                      ? 'text-fg-muted cursor-not-allowed no-underline text-small focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-strong focus-visible:ring-offset-2 focus-visible:ring-offset-canvas'
                      : user.isSuspended
                      ? 'text-fg-primary underline decoration-transparent hover:decoration-fg-primary text-small transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-strong focus-visible:ring-offset-2 focus-visible:ring-offset-canvas'
                      : 'text-state-warning underline decoration-transparent hover:decoration-state-warning text-small transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-strong focus-visible:ring-offset-2 focus-visible:ring-offset-canvas'
                  }
                >
                  {user.isSuspended ? '복구' : '정지'}
                </button>
                <span className="text-fg-muted text-small" aria-hidden="true">·</span>
                <button
                  type="button"
                  disabled={isSelf}
                  title={isSelf ? '자기 계정은 삭제할 수 없습니다' : '계정 삭제'}
                  onClick={() =>
                    setDeleteTarget({
                      email: user.email,
                      firstName: user.firstName,
                      lastName: user.lastName,
                    })
                  }
                  data-testid={`user-detail-delete-${user.email}`}
                  className={
                    isSelf
                      ? 'text-fg-muted cursor-not-allowed no-underline text-small focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-strong focus-visible:ring-offset-2 focus-visible:ring-offset-canvas'
                      : 'text-state-danger underline decoration-transparent hover:decoration-state-danger text-small transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-strong focus-visible:ring-offset-2 focus-visible:ring-offset-canvas'
                  }
                >
                  삭제
                </button>
              </div>
            )}
          </div>
          {isLoading && <p className="text-small text-fg-secondary">불러오는 중...</p>}
          {isError && (
            <div className="border border-state-danger p-4 text-small text-state-danger">
              사용자 정보를 불러오지 못했습니다.
            </div>
          )}
          {!isLoading && !isError && !user && (
            <p className="text-small text-fg-secondary" data-testid="user-detail-not-found">
              사용자를 찾을 수 없습니다: {userEmail}
            </p>
          )}
          {user && (
            <dl className="grid grid-cols-2 gap-x-8 gap-y-3" data-testid="user-detail-info">
              <div>
                <dt className="text-micro uppercase tracking-wide text-fg-secondary">이메일</dt>
                <dd className="text-body font-mono text-fg-primary">{user.email}</dd>
              </div>
              <div>
                <dt className="text-micro uppercase tracking-wide text-fg-secondary">이름</dt>
                <dd className="text-body text-fg-primary">{`${user.lastName}${user.firstName}`.trim() || '-'}</dd>
              </div>
              <div>
                <dt className="text-micro uppercase tracking-wide text-fg-secondary">조직 단위</dt>
                <dd className="text-body font-mono text-fg-secondary">{user.orgUnitPath || '/'}</dd>
              </div>
              <div>
                <dt className="text-micro uppercase tracking-wide text-fg-secondary">권한</dt>
                <dd className="text-body">
                  {user.isAdmin ? (
                    <span className="text-fg-primary font-medium">관리자</span>
                  ) : (
                    <span className="text-fg-muted">일반</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-micro uppercase tracking-wide text-fg-secondary">상태</dt>
                <dd className="text-body">
                  {user.isSuspended ? (
                    <span className="text-state-danger font-medium">정지됨</span>
                  ) : (
                    <span className="text-fg-muted">정상</span>
                  )}
                </dd>
              </div>
            </dl>
          )}
        </section>

        {/* 소속 그룹 */}
        {user && (
          <section className="bg-elevated p-8 border border-border-subtle space-y-4">
            <h2 className="text-h2 font-semibold text-fg-primary">소속 그룹</h2>
            <p className="text-small text-fg-secondary">
              이 사용자가 속한 Google Workspace 그룹 목록입니다.
            </p>
            <UserGroups userEmail={user.email} />
          </section>
        )}

        {/* 감사 이력 */}
        {user && (
          <section className="bg-elevated p-8 border border-border-subtle space-y-4">
            <h2 className="text-h2 font-semibold text-fg-primary">감사 이력</h2>
            <p className="text-small text-fg-secondary">
              이 사용자를 대상으로 발생한 모든 관리자 행위의 기록입니다.
            </p>
            <UserAuditTrail targetEmail={user.email} />
          </section>
        )}
      </div>

      {editTarget && (
        <EditUserDialog
          open={!!editTarget}
          onOpenChange={(o) => !o && setEditTarget(null)}
          user={editTarget}
        />
      )}
      {suspendTarget && (
        <SuspendUserDialog
          open={!!suspendTarget}
          onOpenChange={(o) => !o && setSuspendTarget(null)}
          user={suspendTarget}
        />
      )}
      {resetTarget && (
        <ResetPasswordDialog
          open={!!resetTarget}
          onOpenChange={(o) => !o && setResetTarget(null)}
          user={resetTarget}
        />
      )}
      {deleteTarget && (
        <DeleteUserDialog
          open={!!deleteTarget}
          onOpenChange={(o) => !o && setDeleteTarget(null)}
          user={deleteTarget}
        />
      )}
    </AppShell>
  );
}
