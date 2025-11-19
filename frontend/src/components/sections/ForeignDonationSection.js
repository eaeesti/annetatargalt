"use client";

import { useState } from "react";
import { at, pick } from "@/utils/object";
import AmountChooser from "../elements/forms/AmountChooser";
import NameInput from "../elements/forms/NameInput";
import EmailInput from "../elements/forms/EmailInput";
import CheckboxInput from "../elements/forms/CheckboxInput";
import Markdown from "../elements/Markdown";
import Button from "../elements/Button";
import { makeForeignDonationRequest } from "@/utils/donation";
import Modal from "../Modal";
import { useRouter } from "next/navigation";

export default function ForeignDonationSection(props) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [modalData, setModalData] = useState({});

  function showModal(data) {
    setModalData(data);
    setModalOpen(true);
  }

  const amounts = at(props, ["amount1", "amount2", "amount3"]);
  const amountOptions = amounts.map((amount) => ({
    value: amount,
    label: `${amount}${props.global.currency}`,
  }));

  const [donation, setDonation] = useState({
    amount: amountOptions[1].value,
    firstName: "",
    lastName: "",
    email: "",
    acceptTerms: false,
  });

  const [validity, setValidity] = useState({});
  const isValid =
    at(validity, ["amount", "firstName", "lastName", "email"]).every(Boolean) &&
    donation.acceptTerms;

  const donate = async () => {
    const donationData = pick(donation, ["firstName", "lastName", "email"]);
    donationData.amount = donation.amount * 100;

    const response = await makeForeignDonationRequest(donationData);
    const data = await response.json();

    if (response.ok && data.redirectURL) {
      router.push(data.redirectURL);
    } else if (data.error) {
      showModal({
        icon: "error",
        title: "Error",
        description: `${data.error.name}: ${data.error.message}`,
      });
    } else {
      showModal({
        icon: "error",
        title: "Error",
        description: `There has been an unknown error.`,
      });
    }
  };

  return (
    <section className="flex h-full flex-grow items-start justify-center bg-slate-200 xs:px-4 xs:py-16 sm:px-8 sm:py-32">
      <h1 className="sr-only">{props.title}</h1>
      <div className="flex w-full max-w-lg flex-col gap-4 bg-white px-4 py-24 xs:rounded-2xl xs:px-12 xs:py-12">
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => event.preventDefault()}
        >
          <h2 className="text-2xl font-bold tracking-tight text-primary-700 sm:text-3xl">
            {props.title}
          </h2>
          <Markdown className="prose prose-primary w-full">
            {props.description}
          </Markdown>
          <AmountChooser
            amount={donation.amount}
            setAmount={(amount) => setDonation({ ...donation, amount })}
            amountText={props.amountText}
            amountOptions={amountOptions}
            otherAmountText={props.otherAmountText}
            otherAmountOptionText={props.otherAmountOptionText}
            currency={props.global.currency}
            setValidity={setValidity}
          />
          <NameInput
            firstNameText={props.firstNameText}
            lastNameText={props.lastNameText}
            firstName={donation.firstName}
            lastName={donation.lastName}
            setFirstName={(firstName) =>
              setDonation({ ...donation, firstName })
            }
            setLastName={(lastName) => setDonation({ ...donation, lastName })}
            setValidity={setValidity}
          />
          <EmailInput
            emailText={props.emailText}
            email={donation.email}
            setEmail={(email) => setDonation({ ...donation, email })}
            setValidity={setValidity}
          />
          <CheckboxInput
            name="terms"
            label={props.termsText}
            value={donation.acceptTerms}
            setValue={(acceptTerms) =>
              setDonation({ ...donation, acceptTerms })
            }
          />
          <Button
            text={props.donateButtonText}
            type="primary"
            size="lg"
            onClick={donate}
            buttonType="submit"
            disabled={!isValid}
          />
        </form>
      </div>
      <Modal
        open={modalOpen}
        data={modalData}
        setOpen={setModalOpen}
        closeText="Close"
      />
    </section>
  );
}
