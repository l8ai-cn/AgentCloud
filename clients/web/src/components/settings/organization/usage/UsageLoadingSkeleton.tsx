export function UsageLoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 bg-muted rounded w-48" />
      <div className="h-4 bg-muted rounded w-96" />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="surface-card p-4">
            <div className="h-4 bg-muted rounded w-20 mb-2" />
            <div className="h-8 bg-muted rounded w-24" />
          </div>
        ))}
      </div>
      <div className="surface-card p-6">
        <div className="h-4 bg-muted rounded w-40 mb-4" />
        <div className="h-64 bg-muted rounded" />
      </div>
    </div>
  );
}
