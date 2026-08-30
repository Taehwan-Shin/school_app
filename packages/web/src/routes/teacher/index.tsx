import { useAuth, signOut } from '../../lib/auth';
import { Button } from '../../components/ui/button';

export function TeacherPage() {
  const { user, role } = useAuth();

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <header className="flex justify-between items-center bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">교사 (teacher)</h1>
            <div className="mt-1 flex items-center gap-4 text-sm text-slate-600">
              <span>이메일: <strong>{user?.email || '알 수 없음'}</strong></span>
              <span>역할: <span className="bg-green-100 text-green-800 px-2 py-0.5 rounded text-xs font-semibold">{role}</span></span>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => signOut()}>
            로그아웃
          </Button>
        </header>

        <main className="space-y-6">
          <section className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm space-y-2">
            <h2 className="text-lg font-semibold text-slate-900">본인 클래스룸 목록</h2>
            <p className="text-sm text-slate-600">
              본인 클래스룸 자리 (담당 수업 목록 조회, 학생 명단 확인 및 보관)
            </p>
          </section>
        </main>
      </div>
    </div>
  );
}
