import { Skeleton } from "../../../components/ui/skeleton";
import { PageTitle, TableSkeleton } from "../_components/skeletons";

export default function RecurringDonationsLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <PageTitle title="Recurring Donations" />
        <Skeleton className="h-8 w-28 rounded-md" />
      </div>
      <TableSkeleton columns={7} toolbar={false} />
    </div>
  );
}
