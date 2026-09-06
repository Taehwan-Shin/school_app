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
  const { data, isLoading, isError, error } = useChatMembersList(spaceName, open);

  const showLoading = isLoading || !spaceName;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{displayName || spaceName} 멤버</DialogTitle>
          <DialogDescription>
            <span className="font-mono">{spaceName}</span> 에 속한 멤버 목록.
          </DialogDescription>
        </DialogHeader>
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
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            닫기
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
