export default function Loading() {
  return (
    <div className="flex-1 min-h-screen flex items-center justify-center bg-bg">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-surface-border border-t-primary rounded-full animate-spin" />
        <p className="text-ink-muted text-sm font-medium animate-pulse">Loading...</p>
      </div>
    </div>
  );
}
