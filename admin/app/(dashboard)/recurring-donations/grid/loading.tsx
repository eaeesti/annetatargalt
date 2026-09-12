import { PageTitle, TableSkeleton } from "../../_components/skeletons";

export default function RecurringGridLoading() {
  return (
    <div className="space-y-6">
      <PageTitle title="Recurring Donations" />
      <TableSkeleton columns={12} rows={14} toolbar={false} />
    </div>
  );
}
