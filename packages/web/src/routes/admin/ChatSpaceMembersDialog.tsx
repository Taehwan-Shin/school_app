import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import { Button } from '../../components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';
import { useChatMembersList } from '../../api/chatMembersList';
import { useChatMembersDelete } from '../../api/chatMembersDelete';
import { AddChatMemberDialog } from './AddChatMemberDialog';

export interface ChatSpaceMembersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  spaceName: string | null; // "spaces/AAAA"
  displayName?: string;
}

export function ChatSpaceMembersDialog({
  open,
  onOpenChange,
  spaceName,
  displayName,
}: ChatSpaceMembersDialogProps) {
  const [addOpen, setAddOpen] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState<string | null>(null);
  const deleteMutation = useChatMembersDelete();
  const anyPending = deleteMutation.isPending;

  const { data, isLoading, isError, error } = useChatMembersList(spaceName, open);

  const showLoading = isLoading || !spaceName;

  const handleOpenChange = (next: boolean) => {
    if (!next && anyPending) return;
    onOpenChange(next);
  };

  useEffect(() => {
    if (open && spaceName) {
      setDeleteConfirmName(null);
      deleteMutation.reset?.();
    }
  }, [open, spaceName]);

  const handleDelete = async (memberName: string) => {
    try {
      await deleteMutation.mutateAsync({ memberName });
      setDeleteConfirmName(null);
    } catch {
      // error is surfaced via deleteMutation.error
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{displayName || spaceName} 멤버</DialogTitle>
            <DialogDescription>
              <span className="font-mono">{spaceName}</span> 에 속한 멤버 목록.
            </DialogDescription>
          </DialogHeader>

          {deleteMutation.isError && (
            <div
              className="border border-state-danger p-3 text-small text-state-danger mb-3"
              data-testid="chat-members-action-error"
            >
              오류: {deleteMutation.error?.message || '알 수 없는 오류'}
            </div>
          )}

          {spaceName && !isLoading && !isError && (
            <div className="flex justify-end mb-3">
              <Button
                variant="secondary"
                onClick={() => setAddOpen(true)}
                disabled={anyPending}
                data-testid="chat-members-add-btn"
              >
                + 멤버 추가
              </Button>
            </div>
          )}

          {showLoading && <div data-testid="chat-members-loading">로딩 중...</div>}
          {!showLoading && isError && (
            <div data-testid="chat-members-error">오류: {error?.message}</div>
          )}
          {!showLoading && !isError && data && (
            <div
              className="max-h-96 overflow-y-auto border border-border-subtle"
              data-testid="chat-members-scroll-container"
            >
              <Table>
                <TableHeader className="sticky top-0 bg-canvas">
                  <TableRow>
                    <TableHead>이름/식별자</TableHead>
                    <TableHead>타입</TableHead>
                    <TableHead>역할</TableHead>
                    <TableHead>상태</TableHead>
                    <TableHead className="text-right">관리</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.members.map((m) => (
                    <TableRow key={m.name} data-testid={`chat-member-row-${m.name}`}>
                      <TableCell className="font-mono text-small text-fg-primary">
                        {m.member?.displayName || m.member?.name || m.name}
                      </TableCell>
                      <TableCell className="text-small text-fg-secondary">
                        {m.member?.type || '-'}
                      </TableCell>
                      <TableCell className="text-small text-fg-secondary">
                        {m.role || '-'}
                      </TableCell>
                      <TableCell className="text-small text-fg-secondary">
                        {m.state || '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        {deleteConfirmName === m.name ? (
                          <div className="flex gap-2 justify-end">
                            <button
                              type="button"
                              onClick={() => handleDelete(m.name)}
                              disabled={deleteMutation.isPending}
                              data-testid={`chat-member-confirm-delete-btn-${m.name}`}
                              className="text-state-danger font-semibold underline text-small cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              {deleteMutation.isPending ? '삭제 중...' : '정말 삭제?'}
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteConfirmName(null)}
                              disabled={deleteMutation.isPending}
                              data-testid={`chat-member-cancel-delete-btn-${m.name}`}
                              className="text-fg-secondary underline text-small cursor-pointer disabled:opacity-40"
                            >
                              취소
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmName(m.name)}
                            disabled={deleteMutation.isPending || anyPending}
                            data-testid={`chat-member-delete-btn-${m.name}`}
                            className="text-state-danger underline decoration-transparent hover:decoration-state-danger text-small transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-strong"
                          >
                            삭제
                          </button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          <DialogFooter>
            <Button variant="secondary" onClick={() => handleOpenChange(false)}>
              닫기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {spaceName && (
        <AddChatMemberDialog
          open={addOpen}
          onOpenChange={setAddOpen}
          spaceName={spaceName}
          spaceDisplayName={displayName}
        />
      )}
    </>
  );
}
