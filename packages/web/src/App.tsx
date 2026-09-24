import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from './lib/theme';
import { AuthProvider } from './lib/auth';
import { LoginPage } from './routes/login';
import { RootRedirect } from './routes/RootRedirect';
import { RoleGuard } from './routes/RoleGuard';

// v0.302: route-level code splitting. login/RootRedirect/RoleGuard 는 초기 진입에 필요해 eager,
// admin/super_admin/teacher 는 React.lazy 로 분리 → 초기 bundle (v0.301 기준 980kB) 감축.
// Named export 를 lazy 로 감싸려면 `.then(m => ({ default: m.Named }))` wrapper 필요 (React.lazy 계약).
const SuperAdminPage = lazy(() =>
  import('./routes/super_admin').then((m) => ({ default: m.SuperAdminPage })),
);
const AuditLogPage = lazy(() =>
  import('./routes/super_admin/audit').then((m) => ({ default: m.AuditLogPage })),
);
const CapabilityMatrixPage = lazy(() =>
  import('./routes/super_admin/capabilities').then((m) => ({
    default: m.CapabilityMatrixPage,
  })),
);
const AdminPage = lazy(() =>
  import('./routes/admin').then((m) => ({ default: m.AdminPage })),
);
const AdminChatPage = lazy(() =>
  import('./routes/admin/chat').then((m) => ({ default: m.AdminChatPage })),
);
const AdminClassroomsPage = lazy(() =>
  import('./routes/admin/classrooms').then((m) => ({ default: m.AdminClassroomsPage })),
);
const GroupsPage = lazy(() =>
  import('./routes/admin/groups').then((m) => ({ default: m.GroupsPage })),
);
const GroupDetailPage = lazy(() =>
  import('./routes/admin/groupDetail').then((m) => ({ default: m.GroupDetailPage })),
);
const UserDetailPage = lazy(() =>
  import('./routes/admin/userDetail').then((m) => ({ default: m.UserDetailPage })),
);
const ClassroomDetailPage = lazy(() =>
  import('./routes/admin/classroomDetail').then((m) => ({ default: m.ClassroomDetailPage })),
);
const TeacherPage = lazy(() =>
  import('./routes/teacher').then((m) => ({ default: m.TeacherPage })),
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// v0.302: lazy chunk 로드 중 표시. 각 chunk 는 보통 100~300ms 이내 로드 (loading 은 짧게 flash).
function RouteLoadingFallback() {
  return (
    <div
      className="py-16 text-center text-body text-fg-secondary"
      role="status"
      aria-live="polite"
      data-testid="route-loading"
    >
      불러오는 중...
    </div>
  );
}

export function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <BrowserRouter>
            <Suspense fallback={<RouteLoadingFallback />}>
              <Routes>
                <Route path="/" element={<RootRedirect />} />
                <Route path="/login" element={<LoginPage />} />

                <Route element={<RoleGuard expectedRole="super_admin" />}>
                  <Route path="/super_admin" element={<SuperAdminPage />} />
                  <Route path="/super_admin/audit" element={<AuditLogPage />} />
                  <Route path="/super_admin/capabilities" element={<CapabilityMatrixPage />} />
                  <Route path="/super_admin/chat" element={<AdminChatPage />} />
                  <Route path="/super_admin/classrooms" element={<AdminClassroomsPage />} />
                </Route>

                <Route element={<RoleGuard expectedRoles={['super_admin', 'admin']} />}>
                  <Route path="/admin" element={<AdminPage />} />
                  <Route path="/admin/chat" element={<AdminChatPage />} />
                  <Route path="/admin/classrooms" element={<AdminClassroomsPage />} />
                  <Route path="/admin/classrooms/:id" element={<ClassroomDetailPage />} />
                  <Route path="/admin/groups" element={<GroupsPage />} />
                  <Route path="/admin/groups/:email" element={<GroupDetailPage />} />
                  <Route path="/admin/users/:email" element={<UserDetailPage />} />
                </Route>

                <Route element={<RoleGuard expectedRole="teacher" />}>
                  <Route path="/teacher" element={<TeacherPage />} />
                </Route>

                <Route path="*" element={<RootRedirect />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
