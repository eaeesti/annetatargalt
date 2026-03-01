import Summary from "../Summary";

export default function PaymentSummary({
  donation,
  currency,
  causes,
  totalText,
  tipOrganization,
  tipAmount,
  totalAmount,
}) {
  const organizationAmounts = donation.proportions.calculateAmounts(
    donation.amount,
    causes,
  );

  const tip = {
    title: tipOrganization,
    href: "",
    amount: tipAmount,
  };

  const summary = causes.data
    .map((cause) =>
      cause.organizations
        .filter((organization) =>
          organizationAmounts.some(
            ({ organizationInternalId }) => organizationInternalId === organization.internalId,
          ),
        )
        .map((organization) => ({
          title: organization.title,
          href: `/${cause.slug}/${organization.slug}`,
          amount: organizationAmounts.find(
            ({ organizationInternalId }) => organizationInternalId === organization.internalId,
          ).amount,
        })),
    )
    .flat()
    .concat(tipAmount > 0 ? [tip] : []);

  return (
    <Summary
      summary={summary}
      currency={currency}
      totalText={totalText}
      totalAmount={totalAmount}
    />
  );
}
