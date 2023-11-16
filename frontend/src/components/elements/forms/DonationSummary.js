import { amountsFromProportions } from "@/utils/donation";
import { formatEstonianAmountWithCents } from "@/utils/estonia";
import Anchor from "../Anchor";

export default function DonationSummary({
  donation,
  currency,
  causes,
  totalText,
}) {
  const organizationAmounts = amountsFromProportions({
    proportions: donation.proportions,
    causes: causes,
    totalAmount: donation.amount,
  });

  return (
    <dl className="divide-y divide-slate-200 text-sm">
      {causes.data.map((cause) =>
        cause.attributes.organizations.data
          .filter(
            (organization) =>
              organizationAmounts[organization.id] !== undefined,
          )
          .map((organization, organizationIndex) => (
            <div
              key={organizationIndex}
              className="flex items-center justify-between gap-3 py-2"
            >
              <dt>
                <Anchor
                  href={`/${cause.attributes.slug}/${organization.attributes.slug}`}
                  newTab={true}
                  noIcon={true}
                  className="text-slate-600 hover:opacity-70"
                >
                  {organization.attributes.title}
                </Anchor>
              </dt>
              <dd className="font-medium text-slate-900">
                {formatEstonianAmountWithCents(
                  organizationAmounts[organization.id],
                )}
                {currency}
              </dd>
            </div>
          )),
      )}
      <div className="flex items-center justify-between gap-3 py-2">
        <dt className="font-medium text-slate-900">{totalText}</dt>
        <dd className="font-medium text-primary-700">
          {formatEstonianAmountWithCents(donation.amount)}
          {currency}
        </dd>
      </div>
    </dl>
  );
}
