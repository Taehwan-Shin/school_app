export interface KpiCardProps {
  label: string;
  value: number | string;
  loading?: boolean;
  href?: string;
  active?: boolean;
  onClick?: () => void;
}

export function KpiCard({
  label,
  value,
  loading = false,
  href,
  active = false,
  onClick,
}: KpiCardProps) {
  const containerClasses = [
    'bg-surface p-8 text-left rounded-none border',
    active ? 'border-border-strong' : 'border-border-subtle',
    href
      ? 'hover:border-border-strong transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-border-strong focus-visible:ring-offset-2 focus-visible:ring-offset-canvas'
      : '',
  ]
    .filter(Boolean)
    .join(' ');

  const content = (
    <>
      <div className="text-micro uppercase tracking-wide text-fg-secondary">
        {label}
      </div>
      <div
        className={
          loading
            ? 'text-display text-fg-muted mt-4'
            : 'text-display font-mono text-fg-primary mt-4'
        }
      >
        {loading ? '—' : value}
      </div>
    </>
  );

  if (href) {
    return (
      <button
        type="button"
        onClick={onClick}
        data-testid={`kpi-card-${label}`}
        data-active={active ? 'true' : 'false'}
        className={containerClasses}
      >
        {content}
      </button>
    );
  }

  return (
    <div
      data-testid={`kpi-card-${label}`}
      data-active={active ? 'true' : 'false'}
      className={containerClasses}
    >
      {content}
    </div>
  );
}
