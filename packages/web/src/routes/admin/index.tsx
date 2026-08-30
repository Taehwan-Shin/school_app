import { useAuth, signOut } from '../../lib/auth';
import { Button } from '../../components/ui/button';
import { AccountsTable } from './AccountsTable';

export function AdminPage() {
  const { user, role } = useAuth();

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <header className="flex justify-between items-center bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">관리자 (admin)</h1>
            <div className="mt-1 flex items-center gap-4 text-sm text-slate-600">
              <span>이메일: <strong>{user?.email || '알 수 없음'}</strong></span>
              <span>역할: <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded text-xs font-semibold">{role}</span></span>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => signOut()}>
            로그아웃
          </Button>
        </header>

        <main className="space-y-6">
          <section className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Google Workspace 계정 목록</h2>
            </div>
            <AccountsTable />
          </section>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <section className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm space-y-2">
              <h2 className="text-lg font-semibold text-slate-900">계정·그룹·챗·클래스룸 대시보드</h2>
              <p className="text-sm text-slate-600">
                계정·그룹·챗·클래스룸 대시보드 자리 (일괄 생성, 변경, 삭제, 배정)
              </p>
            </section>

            <section className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm space-y-2">
              <h2 className="text-lg font-semibold text-slate-900">기초값 관리</h2>
              <p className="text-sm text-slate-600">
                기초값 관리 자리 (학년·반·부서 구조 정의 및 시트 동기화)
              </p>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}
