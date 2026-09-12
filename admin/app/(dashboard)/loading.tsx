import {
  ChartSkeleton,
  PageTitle,
  StatCardsSkeleton,
} from "./_components/skeletons";
import { Skeleton } from "../../components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div className="space-y-8">
      <PageTitle title="Dashboard" />
      <StatCardsSkeleton />
      <div className="rounded-lg border bg-card p-5 space-y-3">
        <Skeleton className="h-4 w-64" />
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="grid grid-cols-[14rem_1fr_1fr] gap-4 border-b py-2 last:border-0"
          >
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-32" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartSkeleton />
        <ChartSkeleton />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartSkeleton />
        <ChartSkeleton />
      </div>
    </div>
  );
}
