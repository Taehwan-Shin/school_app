import { useAuth } from '../../lib/auth';
import { AppShell } from '../../components/shell/AppShell';
import { ClassroomTable } from './ClassroomTable';

export function AdminClassroomsPage() {
  const { role } = useAuth();

  return (
    <AppShell role={role} pageTitle="클래스룸">
      <div className="space-y-8">
        <section className="bg-elevated p-8 border border-border-subtle space-y-4">
          <div>
            <h2 className="text-h2 font-semibold text-fg-primary">Google Classroom 코스</h2>
            <p className="text-small text-fg-secondary mt-1">
              내가 접근할 수 있는 클래스룸 코스 목록입니다. 생성 · 편집 · 아카이브는 다음 슬라이스에서 추가됩니다.
            </p>
          </div>
          <ClassroomTable />
        </section>
      </div>
    </AppShell>
  );
}
