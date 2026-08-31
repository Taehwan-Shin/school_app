import { useAuth } from '../../lib/auth';
import { AppShell } from '../../components/shell/AppShell';

export function TeacherPage() {
  const { role } = useAuth();

  return (
    <AppShell role={role} pageTitle="교사">
      <div className="space-y-6">
        <section className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm space-y-2">
          <h2 className="text-lg font-semibold text-slate-900">본인 클래스룸 목록</h2>
          <p className="text-sm text-slate-600">
            본인 클래스룸 자리 (담당 수업 목록 조회, 학생 명단 확인 및 보관)
          </p>
        </section>
      </div>
    </AppShell>
  );
}
