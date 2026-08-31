import { Link, useLocation } from 'react-router-dom';
import type { Role } from '@school-app/shared';
import { useAuth } from '../../lib/auth';
import { getNavItemsForRole } from './nav-items';

interface SidebarProps {
  role?: Role | null;
}

export function Sidebar({ role }: SidebarProps) {
  const { user } = useAuth();
  const location = useLocation();
  const navItems = getNavItemsForRole(role);

  return (
    <aside className="w-60 min-h-screen bg-surface border-r border-border-subtle flex flex-col justify-between hidden md:flex shrink-0">
      <div>
        <div className="px-6 py-4 border-b border-border-subtle">
          <span className="text-h2 font-bold text-fg-primary tracking-tight">학교</span>
        </div>

        <nav className="py-4 space-y-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.to;

            // 아직 라우트가 없는 항목은 클릭 불가로 렌더한다.
            // (Link 로 두면 RootRedirect 로 튐 — 사용자를 혼란시킴.)
            if (item.disabled) {
              return (
                <span
                  key={`${item.to}-${item.label}`}
                  aria-disabled="true"
                  className="block px-4 py-2 text-body text-fg-muted cursor-not-allowed border-l-2 border-transparent select-none"
                  title="아직 준비 중"
                >
                  {item.label}
                </span>
              );
            }

            return (
              <Link
                key={`${item.to}-${item.label}`}
                to={item.to}
                className={`block px-4 py-2 text-body transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface ${
                  isActive
                    ? 'bg-elevated text-fg-primary border-l-2 border-border-strong font-medium'
                    : 'text-fg-secondary hover:bg-elevated hover:text-fg-primary border-l-2 border-transparent'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="p-4 border-t border-border-subtle bg-surface">
        <div className="truncate text-small font-medium text-fg-primary" title={user?.email || ''}>
          {user?.email || '알 수 없음'}
        </div>
        <div className="mt-1">
          <span className="inline-block text-micro uppercase tracking-wide bg-elevated border border-border-subtle px-2 py-0.5 text-fg-secondary">
            {role || '알 수 없음'}
          </span>
        </div>
      </div>
    </aside>
  );
}
