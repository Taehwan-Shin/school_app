import { LogOut } from 'lucide-react';
import { signOut } from '../../lib/auth';
import { ThemeToggle } from './ThemeToggle';

interface TopbarProps {
  pageTitle: string;
}

export function Topbar({ pageTitle }: TopbarProps) {
  return (
    <header className="sticky top-0 z-10 min-h-14 bg-canvas border-b border-border-subtle px-4 md:px-8 py-3 flex items-center gap-3 shrink-0">
      <h1
        title={pageTitle}
        className="text-h2 md:text-h1 font-semibold text-fg-primary flex-1 min-w-0 truncate"
      >
        {pageTitle}
      </h1>
      <div className="flex items-center gap-3 shrink-0">
        <ThemeToggle />
        <button
          type="button"
          onClick={() => signOut()}
          className="inline-flex items-center gap-1.5 border border-border-subtle text-fg-primary px-3 md:px-4 py-2 text-small md:text-body hover:bg-elevated focus:outline-none focus-visible:ring-2 focus-visible:ring-border-strong transition-colors"
          aria-label="로그아웃"
        >
          <LogOut aria-hidden="true" className="w-4 h-4 shrink-0" strokeWidth={2} />
          <span>로그아웃</span>
        </button>
      </div>
    </header>
  );
}
