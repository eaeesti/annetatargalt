import { Skeleton } from "../../../../components/ui/skeleton";
import { SectionSkeleton } from "../../_components/skeletons";

export default function NewTransferLoading() {
  return (
    <div className="max-w-3xl space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-56" />
      </div>
      <SectionSkeleton lines={3} />
      <SectionSkeleton lines={6} />
    </div>
  );
}
