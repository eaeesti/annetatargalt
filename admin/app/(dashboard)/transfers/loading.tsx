import { Skeleton } from "../../../components/ui/skeleton";
import { PageTitle, TableSkeleton } from "../_components/skeletons";

export default function TransfersLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <PageTitle title="Transfers" />
        <Skeleton className="h-8 w-32 rounded-md" />
      </div>
      <TableSkeleton columns={6} rows={8} />
    </div>
  );
}
