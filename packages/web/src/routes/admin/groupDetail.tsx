import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { AppShell } from '../../components/shell/AppShell';
import { MembersTable } from './MembersTable';

export function GroupDetailPage() {
  const { email = '' } = useParams<{ email: string }>();
  const groupEmail = decodeURIComponent(email);
  const navigate = useNavigate();
  const { role } = useAuth();

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
        <section className="bg-elevated p-8 border border-border-subtle space-y-4">
          <h2 className="text-h2 font-semibold text-fg-primary">멤버 관리</h2>
          <p className="text-small text-fg-secondary font-mono">{groupEmail}</p>
          <MembersTable groupEmail={groupEmail} />
        </section>
      </div>
    </AppShell>
  );
}
