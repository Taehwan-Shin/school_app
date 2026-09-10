import { signOut } from '../../lib/auth';
import { ThemeToggle } from './ThemeToggle';

interface TopbarProps {
  pageTitle: string;
}

export function Topbar({ pageTitle }: TopbarProps) {
  return (
    <header className="sticky top-0 z-10 min-h-16 bg-canvas border-b border-border-subtle px-4 md:px-8 py-3 flex items-center gap-3 shrink-0">
      <h1
        title={pageTitle}
        className="font-sans font-bold text-subheading md:font-display md:font-extrabold md:text-heading-sm md:tracking-[0.04em] md:leading-none text-fg-primary flex-1 min-w-0 truncate"
      >
        {pageTitle}
      </h1>
      <div className="flex items-center gap-3 shrink-0">
        <ThemeToggle />
        <button
          type="button"
          onClick={() => signOut()}
          className="rounded-buttons border border-border-strong text-fg-primary px-4 py-2 text-body-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-border-strong hover:bg-highlighter-yellow hover:text-forest-ink dark:hover:bg-elevated dark:hover:text-fg-primary"
        >
          로그아웃
        </button>
      </div>
    </header>
  );
}
