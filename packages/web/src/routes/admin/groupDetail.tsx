import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { AppShell } from '../../components/shell/AppShell';
import { useGroupsList } from '../../api/groupsList';
import { MembersTable } from './MembersTable';
import { GroupAuditTrail } from './GroupAuditTrail';
import { EditGroupDialog, type EditGroupTarget } from './EditGroupDialog';
import { DeleteGroupDialog, type DeleteGroupTarget } from './DeleteGroupDialog';

export function GroupDetailPage() {
  const { email = '' } = useParams<{ email: string }>();
  const groupEmail = decodeURIComponent(email);
  const navigate = useNavigate();
  const { role } = useAuth();
  const { data, isLoading, isError } = useGroupsList();
  const group = data?.groups?.find((g) => g.email.toLowerCase() === groupEmail.toLowerCase());

  const [editTarget, setEditTarget] = useState<EditGroupTarget | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteGroupTarget | null>(null);

  return (
    <AppShell role={role} pageTitle={`그룹: ${groupEmail}`}>
      <div className="space-y-6">
        <button
          type="button"
          onClick={() => navigate('/admin/groups')}
          className="text-fg-secondary hover:text-fg-primary text-small cursor-pointer"
        >
          ← 그룹 목록
        </button>

        {/* 정보 카드 */}
        <section className="bg-elevated p-8 border border-border-subtle space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-h2 font-semibold text-fg-primary">그룹 정보</h2>
            {group && (
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() =>
                    setEditTarget({
                      email: group.email,
                      name: group.name,
                      description: group.description || '',
                    })
                  }
                  data-testid={`group-detail-edit-${group.email}`}
                  className="text-fg-primary underline decoration-transparent hover:decoration-fg-primary text-small transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-strong focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
                >
                  편집
                </button>
                <span className="text-fg-muted text-small" aria-hidden="true">·</span>
                <button
                  type="button"
                  onClick={() =>
                    setDeleteTarget({
                      email: group.email,
                      name: group.name,
                    })
                  }
                  data-testid={`group-detail-delete-${group.email}`}
                  className="text-state-danger underline decoration-transparent hover:decoration-state-danger text-small transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-strong focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
                >
                  삭제
                </button>
              </div>
            )}
          </div>
          {isLoading && <p className="text-small text-fg-secondary">불러오는 중...</p>}
          {isError && (
            <div className="border border-state-danger p-4 text-small text-state-danger">
              그룹 정보를 불러오지 못했습니다.
            </div>
          )}
          {!isLoading && !isError && !group && (
            <p className="text-small text-fg-secondary" data-testid="group-detail-not-found">
              그룹을 찾을 수 없습니다: {groupEmail}
            </p>
          )}
          {group && (
            <dl className="grid grid-cols-2 gap-x-8 gap-y-3" data-testid="group-detail-info">
              <div>
                <dt className="text-micro uppercase tracking-wide text-fg-secondary">이메일</dt>
                <dd className="text-body font-mono text-fg-primary">{group.email}</dd>
              </div>
              <div>
                <dt className="text-micro uppercase tracking-wide text-fg-secondary">이름</dt>
                <dd className="text-body text-fg-primary">{group.name || '-'}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-micro uppercase tracking-wide text-fg-secondary">설명</dt>
                <dd className="text-body text-fg-secondary">{group.description || '-'}</dd>
              </div>
              <div>
                <dt className="text-micro uppercase tracking-wide text-fg-secondary">멤버 수</dt>
                <dd className="text-body font-mono text-fg-primary">{group.directMembersCount}</dd>
              </div>
            </dl>
          )}
        </section>

        {/* 멤버 관리 (기존) */}
        <section className="bg-elevated p-8 border border-border-subtle space-y-4">
          <h2 className="text-h2 font-semibold text-fg-primary">멤버 관리</h2>
          <p className="text-small text-fg-secondary font-mono">{groupEmail}</p>
          <MembersTable groupEmail={groupEmail} />
        </section>

        {/* 감사 이력 */}
        <section className="bg-elevated p-8 border border-border-subtle space-y-4">
          <h2 className="text-h2 font-semibold text-fg-primary">감사 이력</h2>
          <p className="text-small text-fg-secondary">
            이 그룹을 대상으로 발생한 모든 관리자 행위의 기록입니다.
          </p>
          <GroupAuditTrail groupEmail={groupEmail} />
        </section>
      </div>

      {editTarget && (
        <EditGroupDialog
          open={!!editTarget}
          onOpenChange={(o) => !o && setEditTarget(null)}
          group={editTarget}
        />
      )}
      {deleteTarget && (
        <DeleteGroupDialog
          open={!!deleteTarget}
          onOpenChange={(o) => !o && setDeleteTarget(null)}
          group={deleteTarget}
          onSuccess={() => navigate('/admin/groups')}
        />
      )}
    </AppShell>
  );
}
