import Link from "next/link";
import { BrandLogo } from "../components/brand-logo";
import { Button } from "../components/ui/button";

/** An address the admin panel doesn't have. */
export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-sm space-y-4 text-center">
        <BrandLogo className="mx-auto h-12 text-primary" />
        <h1 className="text-2xl font-bold">Not found</h1>
        <p className="text-muted-foreground">
          The admin panel has no page at this address.
        </p>
        <Button variant="outline" render={<Link href="/" />}>
          Go to the dashboard
        </Button>
      </div>
    </div>
  );
}
