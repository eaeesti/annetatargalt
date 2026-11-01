import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { strapiAdmin } from "../../../../lib/api";
import { readJson } from "../../../../lib/read-json";
import { BackLink } from "../../../../components/back-link";
import { EmailEditor } from "../_components/email-editor";
import { SentEmail } from "../_components/sent-email";
import type { Campaign, EmailOptions } from "../_components/types";

type Params = Promise<{ id: string }>;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { id } = await params;
  return { title: `Email #${id}` };
}

export default async function EmailPage({ params }: { params: Params }) {
  const { id } = await params;
  const [res, optionsRes] = await Promise.all([
    strapiAdmin(`/api/admin-panel/emails/${encodeURIComponent(id)}`, {
      cache: "no-store",
    }),
    strapiAdmin("/api/admin-panel/emails/options", { cache: "no-store" }),
  ]);
  if (res.status === 404 || res.status === 400) notFound();
  if (!res.ok || !optionsRes.ok) {
    throw new Error(`Couldn't load the email (${res.status})`);
  }
  const { data: campaign } = await readJson<{ data: Campaign }>(res);
  const { data: options } = await readJson<{ data: EmailOptions }>(optionsRes);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <BackLink href="/emails">Emails</BackLink>
        {campaign.status !== "draft" && (
          <h1 className="text-2xl font-bold">
            {campaign.name || `Untitled email #${campaign.id}`}
          </h1>
        )}
      </div>
      {campaign.status === "draft" ? (
        <EmailEditor campaign={campaign} options={options} />
      ) : (
        <SentEmail campaign={campaign} options={options} />
      )}
    </div>
  );
}
