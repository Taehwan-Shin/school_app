import { useAuth } from '../../lib/auth';
import { AppShell } from '../../components/shell/AppShell';
import { Link } from 'react-router-dom';
import {
  ALL_CAPABILITIES,
  ROLE_CAPABILITIES,
  type Capability,
  type Role,
} from '@school-app/shared';

const ROLES: Role[] = ['super_admin', 'admin', 'teacher'];

// UI 라벨. Capability enum 은 서버가 의존하는 문자열 리터럴이므로 별도 라벨 맵으로 표시만 담당.
const CAPABILITY_LABEL: Record<Capability, string> = {
  'users.read': '사용자 조회',
  'users.write': '사용자 생성·수정',
  'users.delete': '사용자 삭제',
  'users.reset_password': '비밀번호 재설정',
  'groups.read': '그룹 조회',
  'groups.write': '그룹 생성·수정',
  'groups.delete': '그룹 삭제',
  'chat.read': 'Chat 조회',
  'chat.write': 'Chat 스페이스 생성·멤버 관리',
  'chat.delete': 'Chat 스페이스 삭제',
  'classroom.read': 'Classroom 코스 조회',
  'classroom.write': 'Classroom 코스 생성·수정',
  'classroom.transfer_owner': 'Classroom 소유자 이전',
  'classroom.archive': 'Classroom 코스 보관',
  'basic_data.read': '기초 데이터 조회',
  'basic_data.write': '기초 데이터 수정',
  'audit.read': '감사 로그 조회',
  'system.manage_roles': '역할 관리',
};

const ROLE_LABEL: Record<Role, string> = {
  super_admin: 'super_admin',
  admin: 'admin',
  teacher: 'teacher',
};

export function CapabilityMatrixPage() {
  const { role } = useAuth();

  return (
    <AppShell role={role} pageTitle="역할·권한 매트릭스">
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-h2 font-semibold text-fg-primary">Capability Matrix</h2>
            <p className="text-small text-fg-secondary mt-1">
              각 역할이 실제로 실행 가능한 서버 capability 목록입니다. 서버
              <code className="px-1 font-mono">packages/shared/src/roleCapabilities.ts</code>
              가 진실의 원본이고, 이 화면은 그 상수를 시각화만 합니다.
            </p>
          </div>
          <Link
            to="/super_admin"
            className="text-fg-primary underline decoration-transparent hover:decoration-fg-primary text-small transition-colors"
          >
            ← 슈퍼 관리자 대시보드
          </Link>
        </div>

        <div className="border border-border-subtle overflow-x-auto bg-canvas">
          <table
            data-testid="capability-matrix-table"
            className="w-full border-collapse text-small"
          >
            <thead>
              <tr className="border-b border-border-subtle bg-canvas-subtle">
                <th className="text-left px-4 py-2 text-fg-secondary font-medium">Capability</th>
                {ROLES.map((r) => (
                  <th
                    key={r}
                    className="text-center px-4 py-2 text-fg-secondary font-medium"
                    data-testid={`capability-matrix-role-${r}`}
                  >
                    {ROLE_LABEL[r]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ALL_CAPABILITIES.map((cap) => (
                <tr
                  key={cap}
                  className="border-b border-border-subtle"
                  data-testid={`capability-matrix-row-${cap}`}
                >
                  <td className="px-4 py-2">
                    <div className="font-medium text-fg-primary">{CAPABILITY_LABEL[cap]}</div>
                    <div className="font-mono text-xs text-fg-secondary">{cap}</div>
                  </td>
                  {ROLES.map((r) => {
                    const has = ROLE_CAPABILITIES[r].has(cap);
                    return (
                      <td
                        key={r}
                        className="text-center px-4 py-2"
                        data-testid={`capability-matrix-cell-${cap}-${r}`}
                      >
                        {has ? (
                          <span className="text-state-success font-mono">O</span>
                        ) : (
                          <span className="text-fg-muted font-mono">·</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-canvas-subtle border-t border-border-subtle">
                <td className="px-4 py-2 text-fg-secondary text-xs">
                  총 {ALL_CAPABILITIES.length}개 capability
                </td>
                {ROLES.map((r) => (
                  <td
                    key={r}
                    className="text-center px-4 py-2 text-fg-secondary text-xs font-mono"
                    data-testid={`capability-matrix-total-${r}`}
                  >
                    {ROLE_CAPABILITIES[r].size} / {ALL_CAPABILITIES.length}
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="text-xs text-fg-muted space-y-1">
          <p>* 이 매트릭스는 서버가 실행하는 실제 검사와 일치합니다 (<code className="font-mono">userHasCap</code>).</p>
          <p>
            * 역할 변경 UI 는 아직 없음. 조정은{' '}
            <code className="font-mono">packages/functions/scripts/promote-user.mjs</code>{' '}
            를 실행해 Firebase Auth custom claim 과 Firestore <code className="font-mono">users/&lt;uid&gt;</code>{' '}
            문서 role 을 함께 갱신하고, 대상 사용자가 로그아웃·재로그인해야 새 role 이 세션에 반영됩니다.
          </p>
        </div>
      </div>
    </AppShell>
  );
}
