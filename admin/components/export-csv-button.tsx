"use client";

import { Download } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "./ui/button";

/**
 * Downloads every row of `table` that matches the page's filters, in the
 * table's sort order, as a CSV file.
 */
export function ExportCsvButton({
  table,
  sortBy,
  sortDir,
}: {
  table: string;
  /** the sort the table shows, defaults included */
  sortBy?: string;
  sortDir?: "asc" | "desc";
}) {
  const searchParams = useSearchParams();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function download() {
    setBusy(true);
    setError(null);
    const params = new URLSearchParams(searchParams);
    params.delete("page");
    params.delete("pageSize");
    if (sortBy) params.set("sortBy", sortBy);
    if (sortDir) params.set("sortDir", sortDir);
    try {
      const res = await fetch(`/api/export/${table}?${params}`);
      if (!res.ok) {
        const body: unknown = await res.json().catch(() => null);
        setError(
          typeof body === "object" &&
            body !== null &&
            "error" in body &&
            typeof body.error === "string"
            ? body.error
            : "The export failed. Try again in a moment.",
        );
        return;
      }
      const name =
        /filename="([^"]+)"/.exec(
          res.headers.get("Content-Disposition") ?? "",
        )?.[1] ?? `${table}.csv`;
      const url = URL.createObjectURL(await res.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = name;
      link.click();
      // revoked a moment later, as some browsers read it after click() returns
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setError("The export failed. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      {error && (
        <span role="alert" className="text-xs text-destructive">
          {error}
        </span>
      )}
      <Button variant="outline" size="sm" onClick={download} disabled={busy}>
        <Download className="mr-1.5 h-4 w-4" />
        {busy ? "Exporting…" : "Export CSV"}
      </Button>
    </span>
  );
}
