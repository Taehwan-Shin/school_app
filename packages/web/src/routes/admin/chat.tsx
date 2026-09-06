import { useAuth } from '../../lib/auth';
import { AppShell } from '../../components/shell/AppShell';
import { ChatSpacesTable } from './ChatSpacesTable';

export function AdminChatPage() {
  const { role } = useAuth();

  return (
    <AppShell role={role} pageTitle="챗방">
      <div className="space-y-8">
        <section className="bg-elevated p-8 border border-border-subtle space-y-4">
          <div>
            <h2 className="text-h2 font-semibold text-fg-primary">Google Chat 스페이스</h2>
            <p className="text-small text-fg-secondary mt-1">
              내가 멤버로 속한 챗방 목록입니다. 생성·삭제·멤버 관리는 다음 슬라이스에서 추가됩니다.
            </p>
          </div>
          <ChatSpacesTable />
        </section>
      </div>
    </AppShell>
  );
}
