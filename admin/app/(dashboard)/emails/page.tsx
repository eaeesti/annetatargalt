import type { Metadata } from "next";
import Link from "next/link";
import { strapiAdmin } from "../../../lib/api";
import { readJson } from "../../../lib/read-json";
import { formatDate } from "../../../lib/dates";
import { Badge } from "../../../components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../components/ui/table";
import { NewEmailButton } from "./_components/new-email-button";
import type { EmailOptions } from "./_components/types";

export const metadata: Metadata = { title: "Emails" };

interface EmailRow {
  id: number;
  kind: string;
  name: string;
  status: "draft" | "sending" | "sent";
  createdBy: string | null;
  createdAt: string;
  sentAt: string | null;
  sent: number;
  failed: number;
}

const STATUS_LABELS: Record<EmailRow["status"], string> = {
  draft: "Draft",
  sending: "Sending",
  sent: "Sent",
};

export default async function EmailsPage() {
  const [res, optionsRes] = await Promise.all([
    strapiAdmin("/api/admin-panel/emails/list", { cache: "no-store" }),
    strapiAdmin("/api/admin-panel/emails/options", { cache: "no-store" }),
  ]);
  if (!res.ok || !optionsRes.ok) {
    throw new Error(`Couldn't load the emails (${res.status})`);
  }
  const { data } = await readJson<{ data: EmailRow[] }>(res);
  const { data: options } = await readJson<{ data: EmailOptions }>(optionsRes);
  const kindLabel = (kind: string) =>
    options.kinds.find((option) => option.value === kind)?.label ?? kind;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold">Emails</h1>
          <p className="text-sm text-muted-foreground">
            Newsletters and other emails to groups of donors. Confirmations of
            donations are written in Strapi and go out on their own.
          </p>
        </div>
        <NewEmailButton>New email</NewEmailButton>
      </div>
      {data.length === 0 ? (
        <p className="text-sm text-muted-foreground">No emails yet.</p>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Sent to</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((email) => (
                <TableRow key={email.id}>
                  <TableCell>
                    <Link
                      href={`/emails/${email.id}`}
                      className="font-medium hover:underline"
                    >
                      {email.name || `Untitled email #${email.id}`}
                    </Link>
                  </TableCell>
                  <TableCell>{kindLabel(email.kind)}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        email.status === "draft" ? "secondary" : "default"
                      }
                    >
                      {STATUS_LABELS[email.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {email.status === "draft" ? "" : email.sent}
                    {email.failed > 0 && (
                      <span className="text-destructive">
                        {" "}
                        ({email.failed} failed)
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {formatDate(email.sentAt ?? email.createdAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
