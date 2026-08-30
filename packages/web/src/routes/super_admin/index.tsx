import { useAuth, signOut } from '../../lib/auth';
import { Button } from '../../components/ui/button';

export function SuperAdminPage() {
  const { user, role } = useAuth();

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <header className="flex justify-between items-center bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">슈퍼 관리자 (super_admin)</h1>
            <div className="mt-1 flex items-center gap-4 text-sm text-slate-600">
              <span>이메일: <strong>{user?.email || '알 수 없음'}</strong></span>
              <span>역할: <span className="bg-purple-100 text-purple-800 px-2 py-0.5 rounded text-xs font-semibold">{role}</span></span>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => signOut()}>
            로그아웃
          </Button>
        </header>

        <main className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
        </main>
      </div>
    </div>
  );
}
