import { PageTitle, TableSkeleton } from "../_components/skeletons";

export default function DonorsLoading() {
  return (
    <div className="space-y-6">
      <PageTitle title="Donors" />
      <TableSkeleton columns={7} />
    </div>
  );
}
