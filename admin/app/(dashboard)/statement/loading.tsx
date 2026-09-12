import { Skeleton } from "../../../components/ui/skeleton";
import { PageTitle } from "../_components/skeletons";

export default function StatementLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <PageTitle title="Statement import" />
        <Skeleton className="h-4 w-2/3" />
      </div>
      <Skeleton className="h-40 w-full rounded-lg" />
    </div>
  );
}
