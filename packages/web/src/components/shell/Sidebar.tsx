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
    <aside className="w-60 min-h-screen bg-surface border-r border-border-subtle flex-col justify-between hidden md:flex shrink-0">
      <div>
        <div className="px-6 py-4 border-b border-border-subtle">
          <span className="text-h2 font-bold text-fg-primary tracking-tight">학교</span>
        </div>

        <nav className="py-4 space-y-0.5" aria-label="주요 메뉴">
          {navItems.map((item) => {
            const isActive = location.pathname === item.to;
            const Icon = item.icon;

            // disabled 항목: 클릭 불가, 옅은 회색으로 렌더 (라우트 미도착시 RootRedirect 로 튐 방지).
            if (item.disabled) {
              return (
                <span
                  key={`${item.to}-${item.label}`}
                  aria-disabled="true"
                  className="flex items-center gap-3 px-4 py-2.5 text-body text-fg-muted cursor-not-allowed border-l-2 border-transparent select-none"
                  title="아직 준비 중"
                >
                  <Icon aria-hidden="true" className="w-4 h-4 shrink-0" strokeWidth={2} />
                  <span className="truncate">{item.label}</span>
                </span>
              );
            }

            return (
              <Link
                key={`${item.to}-${item.label}`}
                to={item.to}
                aria-current={isActive ? 'page' : undefined}
                className={`flex items-center gap-3 px-4 py-2.5 text-body transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface ${
                  isActive
                    ? 'bg-elevated text-fg-primary border-l-2 border-border-strong font-semibold'
                    : 'text-fg-secondary hover:bg-elevated hover:text-fg-primary border-l-2 border-transparent'
                }`}
              >
                <Icon
                  aria-hidden="true"
                  className={`w-4 h-4 shrink-0 ${isActive ? 'text-fg-primary' : 'text-fg-secondary'}`}
                  strokeWidth={isActive ? 2.25 : 2}
                />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="p-4 border-t border-border-subtle bg-surface">
        <div className="truncate text-small font-semibold text-fg-primary" title={user?.email || ''}>
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
