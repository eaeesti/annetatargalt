import { fetchOrgs } from "../../../lib/orgs";
import { Badge } from "../../../components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../components/ui/table";

const STRAPI_URL = process.env.STRAPI_URL ?? "http://localhost:1337";

// Tailwind background + text color pairs for the initial avatar
const AVATAR_COLORS = [
  "bg-blue-100 text-blue-700",
  "bg-emerald-100 text-emerald-700",
  "bg-violet-100 text-violet-700",
  "bg-amber-100 text-amber-700",
  "bg-rose-100 text-rose-700",
  "bg-cyan-100 text-cyan-700",
  "bg-orange-100 text-orange-700",
  "bg-teal-100 text-teal-700",
];

function avatarColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function logoUrl(url: string): string {
  // Strapi returns absolute URLs when using cloud storage (S3, Cloudinary, etc.)
  // and relative paths for local uploads — handle both
  return url.startsWith("http") ? url : `${STRAPI_URL}${url}`;
}

export default async function OrganizationsPage() {
  const orgs = await fetchOrgs();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Organizations</h1>
        <p className="text-sm text-muted-foreground">{orgs.length} total</p>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12"></TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Internal ID</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Website</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orgs.map((org) => (
            <TableRow key={org.id}>
              <TableCell>
                {org.logo ? (
                  <img
                    src={logoUrl(org.logo.url)}
                    alt={org.logo.alternativeText ?? org.title ?? ""}
                    className="h-7 w-7 rounded object-contain"
                  />
                ) : (
                  <div className={`h-7 w-7 rounded flex items-center justify-center text-xs font-semibold ${avatarColor(org.internalId)}`}>
                    {(org.title ?? org.internalId).charAt(0).toUpperCase()}
                  </div>
                )}
              </TableCell>
              <TableCell className="font-medium">{org.title ?? "—"}</TableCell>
              <TableCell className="font-mono text-xs text-muted-foreground">
                {org.internalId}
              </TableCell>
              <TableCell>
                {org.fund ? (
                  <Badge variant="secondary">Fund</Badge>
                ) : (
                  <Badge variant="outline">Organization</Badge>
                )}
              </TableCell>
              <TableCell>
                {org.active ? (
                  <Badge variant="default">Active</Badge>
                ) : (
                  <Badge variant="secondary">Inactive</Badge>
                )}
              </TableCell>
              <TableCell className="text-sm">
                {org.homepage ? (
                  <a
                    href={org.homepage}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline-offset-4 hover:underline"
                  >
                    {org.homepage.replace(/^https?:\/\//, "")}
                  </a>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
            </TableRow>
          ))}
          {orgs.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                No organizations found. Check that Strapi is running.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
