import Link from "next/link";
import { Button } from "../../components/ui/button";

/** A donation, donor, transfer or other record that isn't there, maybe deleted. */
export default function NotFound() {
  return (
    <div className="max-w-xl space-y-4 py-12">
      <h1 className="text-2xl font-bold">Not found</h1>
      <p className="text-muted-foreground">
        There&apos;s nothing here. It may have been deleted, or the address may
        be wrong.
      </p>
      <Button variant="outline" render={<Link href="/" />}>
        Go to the dashboard
      </Button>
    </div>
  );
}
