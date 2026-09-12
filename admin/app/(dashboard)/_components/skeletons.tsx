import { Skeleton } from "../../../components/ui/skeleton";

/**
 * Route-level loading fallbacks. Next renders these the instant a navigation
 * starts — before the server has said anything — so they exist to make the
 * destination page feel like it's already there: real heading text, the same
 * chrome (toolbar, table frame, card grid), and shimmer only where the data
 * goes. A bare spinner would blank the whole pane and make a fast page feel
 * slower than it is.
 */

export function PageTitle({ title }: { title: string }) {
  return <h1 className="text-2xl font-bold">{title}</h1>;
}

/** Toolbar row: a result count plus the "Add filter" control. */
function ToolbarSkeleton() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Skeleton className="h-5 w-28" />
      <Skeleton className="h-7 w-20 rounded-md" />
    </div>
  );
}

export function TableSkeleton({
  columns = 6,
  rows = 12,
  toolbar = true,
}: {
  columns?: number;
  rows?: number;
  toolbar?: boolean;
}) {
  return (
    <div className="space-y-4">
      {toolbar && <ToolbarSkeleton />}
      <div className="rounded-md border">
        {/* Header row */}
        <div className="flex items-center gap-4 border-b px-4 py-3">
          {Array.from({ length: columns }).map((_, i) => (
            <Skeleton key={i} className="h-4 flex-1" />
          ))}
        </div>
        {/* Body rows — decreasing opacity keeps the eye at the top of the list */}
        {Array.from({ length: rows }).map((_, r) => (
          <div
            key={r}
            className="flex items-center gap-4 border-b px-4 py-3 last:border-0"
            style={{ opacity: Math.max(0.25, 1 - r * 0.06) }}
          >
            {Array.from({ length: columns }).map((_, c) => (
              <Skeleton key={c} className="h-4 flex-1" />
            ))}
          </div>
        ))}
      </div>
      {/* Pagination row */}
      <div className="flex items-center justify-between gap-4">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-7 w-48" />
      </div>
    </div>
  );
}

/** A bordered card with a heading and `lines` label/value rows. */
export function SectionSkeleton({ lines = 4 }: { lines?: number }) {
  return (
    <div className="rounded-lg border bg-card p-5 space-y-3">
      <Skeleton className="h-4 w-32" />
      <div className="space-y-2">
        {Array.from({ length: lines }).map((_, i) => (
          <div key={i} className="grid grid-cols-[10rem_1fr] gap-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-40" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Detail pages: back link, title, then a stack of sections. */
export function DetailSkeleton({
  sections = 3,
  maxWidth = "max-w-2xl",
}: {
  sections?: number;
  maxWidth?: string;
}) {
  return (
    <div className={`space-y-6 ${maxWidth}`}>
      <div className="space-y-2">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-8 w-72" />
      </div>
      {Array.from({ length: sections }).map((_, i) => (
        <SectionSkeleton key={i} lines={i === 0 ? 5 : 3} />
      ))}
    </div>
  );
}

export function StatCardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-lg border bg-card p-5 space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-7 w-32" />
        </div>
      ))}
    </div>
  );
}

export function ChartSkeleton({ title }: { title?: string }) {
  return (
    <div className="rounded-lg border bg-card p-5 space-y-3">
      {title ? (
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </h2>
      ) : (
        <Skeleton className="h-4 w-48" />
      )}
      {/* Bars of varied height read as "a chart is coming" at a glance */}
      <div className="flex h-[220px] items-end gap-1.5">
        {[45, 70, 35, 85, 55, 95, 40, 75, 60, 88, 50, 80].map((h, i) => (
          <Skeleton key={i} className="flex-1" style={{ height: `${h}%` }} />
        ))}
      </div>
    </div>
  );
}
