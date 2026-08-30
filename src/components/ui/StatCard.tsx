export default function StatCard({
  value,
  label,
  color = "text-primary",
}: {
  value: string | number;
  label: string;
  color?: string;
}) {
  return (
    <div className="card flex flex-col items-center justify-center py-4">
      <span className={`text-3xl font-bold tabular-nums ${color}`}>{value}</span>
      <span className="text-xs text-ink-muted mt-1 font-medium">{label}</span>
    </div>
  );
}
