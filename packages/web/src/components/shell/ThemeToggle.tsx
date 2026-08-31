import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../../lib/theme';

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={theme === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환'}
      className="p-2 border border-border-subtle text-fg-secondary hover:text-fg-primary hover:bg-elevated focus:outline-none focus-visible:ring-2 focus-visible:ring-border-strong transition-colors"
    >
      {theme === 'dark' ? (
        <Sun className="h-4 w-4" aria-hidden="true" />
      ) : (
        <Moon className="h-4 w-4" aria-hidden="true" />
      )}
    </button>
  );
}
