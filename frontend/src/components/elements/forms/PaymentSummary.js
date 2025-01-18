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
      cause.attributes.organizations.data
        .filter((organization) =>
          organizationAmounts.some(
            ({ organizationId }) => organizationId === organization.id,
          ),
        )
        .map((organization) => ({
          title: organization.attributes.title,
          href: `/${cause.attributes.slug}/${organization.attributes.slug}`,
          amount: organizationAmounts.find(
            ({ organizationId }) => organizationId === organization.id,
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
