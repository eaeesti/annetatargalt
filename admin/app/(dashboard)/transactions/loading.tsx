import { PageTitle, TableSkeleton } from "../_components/skeletons";

export default function TransactionsLoading() {
  return (
    <div className="space-y-6">
      <PageTitle title="Transactions" />
      <TableSkeleton columns={7} />
    </div>
  );
}
