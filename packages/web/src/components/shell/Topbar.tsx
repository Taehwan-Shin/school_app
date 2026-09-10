import { signOut } from '../../lib/auth';
import { ThemeToggle } from './ThemeToggle';

interface TopbarProps {
  pageTitle: string;
}

export function Topbar({ pageTitle }: TopbarProps) {
  return (
    <header className="sticky top-0 z-10 h-16 bg-canvas border-b border-border-subtle px-6 md:px-8 flex items-center justify-between shrink-0">
      <h1 className="font-display text-heading-sm text-fg-primary" style={{ letterSpacing: '0.03em' }}>
        {pageTitle}
      </h1>
      <div className="flex items-center gap-3">
        <ThemeToggle />
        <button
          type="button"
          onClick={() => signOut()}
          className="rounded-buttons border border-border-strong text-fg-primary px-4 py-2 text-body-sm font-medium hover:bg-highlighter-yellow focus:outline-none focus-visible:ring-2 focus-visible:ring-border-strong transition-colors"
        >
          로그아웃
        </button>
      </div>
    </header>
  );
}
