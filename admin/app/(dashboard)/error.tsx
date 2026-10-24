"use client";

import { RotateCw, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { Button } from "../../components/ui/button";

/**
 * When a page fails. It sits inside the dashboard's layout, so the sidebar
 * stays. `retry` fetches the page again, so Try again helps after a backend
 * or network blip (`reset` only redrew it). In production the error's message
 * is hidden; its digest finds it in the server's log.
 */
export default function DashboardError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="max-w-xl space-y-4 py-12">
      <h1 className="flex items-center gap-2 text-2xl font-bold">
        <TriangleAlert className="size-6 text-destructive" />
        Something went wrong
      </h1>
      <p className="text-muted-foreground">
        This page couldn&apos;t be loaded. Try again, and if it keeps happening,
        tell whoever looks after the admin panel what you were doing
        {error.digest ? (
          <>
            , with the reference{" "}
            <code className="font-mono">{error.digest}</code>
          </>
        ) : null}
        .
      </p>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => retry()}>
          <RotateCw />
          Try again
        </Button>
        <Button variant="outline" render={<Link href="/" />}>
          Go to the dashboard
        </Button>
      </div>
    </div>
  );
}
