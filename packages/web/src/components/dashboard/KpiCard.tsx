export interface KpiCardProps {
  label: string;
  value: number | string;
  loading?: boolean;
}

export function KpiCard({ label, value, loading = false }: KpiCardProps) {
  return (
    <div
      data-testid={`kpi-card-${label}`}
      className="bg-surface border border-border-subtle rounded-none p-8"
    >
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
    </div>
  );
}
