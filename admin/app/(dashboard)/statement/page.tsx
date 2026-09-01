import { StatementImport } from "./_components/statement-import";

export default function StatementPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Statement import</h1>
        <p className="text-sm text-muted-foreground">
          Upload an LHV account-statement CSV. Recurring payments become
          donation records, bank transfers get their transaction ID, and
          everything else is triaged.
        </p>
      </div>
      <StatementImport />
    </div>
  );
}
