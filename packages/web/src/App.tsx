import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from './lib/theme';
import { AuthProvider } from './lib/auth';
import { LoginPage } from './routes/login';
import { RootRedirect } from './routes/RootRedirect';
import { RoleGuard } from './routes/RoleGuard';
import { SuperAdminPage } from './routes/super_admin';
import { AuditLogPage } from './routes/super_admin/audit';
import { AdminPage } from './routes/admin';
import { TeacherPage } from './routes/teacher';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<RootRedirect />} />
              <Route path="/login" element={<LoginPage />} />

              <Route element={<RoleGuard expectedRole="super_admin" />}>
                <Route path="/super_admin" element={<SuperAdminPage />} />
                <Route path="/super_admin/audit" element={<AuditLogPage />} />
              </Route>

              <Route element={<RoleGuard expectedRoles={['super_admin', 'admin']} />}>
                <Route path="/admin" element={<AdminPage />} />
              </Route>

              <Route element={<RoleGuard expectedRole="teacher" />}>
                <Route path="/teacher" element={<TeacherPage />} />
              </Route>

              <Route path="*" element={<RootRedirect />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
