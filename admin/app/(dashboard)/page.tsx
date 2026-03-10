import { strapiAdmin } from "../../lib/api";
import { Badge } from "../../components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";

interface Donor {
  id: number;
  name: string | null;
  email: string | null;
  idCode: string | null;
}

interface OrganizationDonation {
  organizationInternalId: string;
  amount: number;
}

interface Donation {
  id: number;
  datetime: string;
  amount: number;
  finalized: boolean;
  paymentMethod: string | null;
  companyName: string | null;
  externalDonation: boolean;
  donor: Donor | null;
  organizationDonations: OrganizationDonation[];
}

interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  pageCount: number;
}

interface ListResponse {
  data: Donation[];
  pagination: Pagination;
}

function formatAmount(cents: number): string {
  return `€${(cents / 100).toFixed(2)}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("et-EE", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function DashboardPage() {
  const res = await strapiAdmin("/api/donations/list?pageSize=50", { cache: "no-store" });

  if (!res.ok) {
    return (
      <p className="text-red-600">
        Failed to load donations ({res.status}). Check that Strapi is running.
      </p>
    );
  }

  const { data: donations, pagination } = await res.json() as ListResponse;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Donations</h1>
        <p className="text-sm text-gray-500">{pagination.total} total</p>
      </div>

      <Card>
        <CardHeader className="pb-0">
          <CardTitle className="text-base font-medium text-gray-600">
            Most recent {donations.length}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Donor</TableHead>
                <TableHead>Organizations</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Payment</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {donations.map((donation) => (
                <TableRow key={donation.id}>
                  <TableCell className="font-mono text-xs text-gray-500">
                    #{donation.id}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm">
                    {formatDate(donation.datetime)}
                  </TableCell>
                  <TableCell className="font-medium">
                    {formatAmount(donation.amount)}
                  </TableCell>
                  <TableCell className="text-sm">
                    {donation.companyName ??
                      donation.donor?.name ??
                      donation.donor?.email ??
                      <span className="text-gray-400">—</span>}
                  </TableCell>
                  <TableCell className="text-sm">
                    {donation.organizationDonations.length > 0
                      ? donation.organizationDonations
                          .map((od) => `${od.organizationInternalId} (${formatAmount(od.amount)})`)
                          .join(", ")
                      : <span className="text-gray-400">—</span>}
                  </TableCell>
                  <TableCell>
                    {donation.finalized ? (
                      <Badge variant="default">Finalized</Badge>
                    ) : (
                      <Badge variant="secondary">Pending</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-gray-500">
                    {donation.paymentMethod ?? "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
