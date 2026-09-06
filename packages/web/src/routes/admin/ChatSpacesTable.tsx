import { useChatList } from '../../api/chatList';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';

export function ChatSpacesTable() {
  const { data, isLoading, isError, error } = useChatList();

  return (
    <div className="space-y-4">
      {isLoading && (
        <div className="py-8 text-center text-small text-fg-secondary" data-testid="chat-spaces-loading">
          챗방 목록을 불러오는 중...
        </div>
      )}
      {isError && (
        <div className="border border-state-danger p-4 text-small text-state-danger" data-testid="chat-spaces-error">
          챗방 목록을 불러오지 못했습니다: {error?.message || '알 수 없는 오류'}
        </div>
      )}
      {!isLoading && !isError && (!data?.spaces || data.spaces.length === 0) && (
        <div className="py-8 text-center text-small text-fg-secondary" data-testid="chat-spaces-empty">
          속한 챗방이 없습니다.
        </div>
      )}
      {data?.spaces && data.spaces.length > 0 && (
        <div className="border border-border-subtle rounded-none overflow-x-auto bg-canvas">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>이름</TableHead>
                <TableHead>타입</TableHead>
                <TableHead>ID</TableHead>
                <TableHead>생성 시각</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.spaces.map((s) => (
                <TableRow key={s.name} data-testid={`chat-space-row-${s.name}`}>
                  <TableCell className="text-fg-primary">
                    {s.displayName || <span className="text-fg-muted">(무제)</span>}
                  </TableCell>
                  <TableCell className="text-small text-fg-secondary">{s.spaceType || '-'}</TableCell>
                  <TableCell className="font-mono text-small text-fg-secondary">{s.name}</TableCell>
                  <TableCell className="font-mono text-small text-fg-secondary whitespace-nowrap">
                    {s.createTime ? new Date(s.createTime).toLocaleString('ko-KR') : '-'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
