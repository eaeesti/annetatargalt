"use client";

import { useState } from "react";
import { pick } from "@/utils/object";
import AmountChooser from "../elements/forms/AmountChooser";
import DonationTypeChooser from "../elements/forms/DonationTypeChooser";

export default function DonationSection(props) {
  const amounts = pick(props, ["amount1", "amount2", "amount3"]);
  const amountOptions = amounts.map((amount) => ({
    value: amount,
    label: `${amount}${props.currency}`,
  }));

  const [donation, setDonation] = useState({
    amount: amountOptions[1].value,
    type: "recurring",
  });
  console.log(donation);

  return (
    <section className="flex h-full flex-grow items-start justify-center bg-slate-200 xs:px-4 xs:py-16 sm:px-8 sm:py-32">
      <div className="flex w-full max-w-lg flex-col gap-4 bg-white px-4 py-24 xs:rounded-2xl xs:px-12 xs:py-12">
        <h2 className="mb-4 text-2xl font-bold tracking-tight text-primary-700 sm:text-3xl">
          {props.title}
        </h2>
        <DonationTypeChooser
          donationType={donation.type}
          setDonationType={(type) => setDonation({ ...donation, type })}
          label={props.donationTypeText}
          recurringDonationText={props.recurringDonationText}
          singleDonationText={props.singleDonationText}
        />
        <AmountChooser
          amount={donation.amount}
          setAmount={(amount) => setDonation({ ...donation, amount })}
          amountText={props.amountText}
          amountOptions={amountOptions}
          otherAmountText={props.otherAmountText}
          otherAmountOptionText={props.otherAmountOptionText}
          currency={props.currency}
        />
      </div>
    </section>
  );
}
