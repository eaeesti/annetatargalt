import { PageTitle, TableSkeleton } from "../_components/skeletons";

export default function DonationsLoading() {
  return (
    <div className="space-y-6">
      <PageTitle title="Donations" />
      <TableSkeleton columns={7} />
    </div>
  );
}
