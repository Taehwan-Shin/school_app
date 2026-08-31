import { useAuth } from '../../lib/auth';
import { AppShell } from '../../components/shell/AppShell';

export function SuperAdminPage() {
  const { role } = useAuth();

  return (
    <AppShell role={role} pageTitle="슈퍼 관리자">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <section className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm space-y-2">
          <h2 className="text-lg font-semibold text-slate-900">감사 로그</h2>
          <p className="text-sm text-slate-600">
            감사 로그 자리 (모든 쓰기·삭제 이력 및 보안 이벤트 조회)
          </p>
        </section>

        <section className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm space-y-2">
          <h2 className="text-lg font-semibold text-slate-900">함수 상태</h2>
          <p className="text-sm text-slate-600">
            함수 상태 자리 (Cloud Functions 실행 및 헬스체크 모니터링)
          </p>
        </section>

        <section className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm space-y-2 md:col-span-2">
          <h2 className="text-lg font-semibold text-slate-900">위험 조작 및 시스템 설정</h2>
          <p className="text-sm text-slate-600">
            위험 조작 및 역할 관리 자리 (사용자 역할 승격/좌천 및 시스템 설정)
          </p>
        </section>
      </div>
    </AppShell>
  );
}
