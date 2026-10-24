"use client";

import { useState } from "react";
import { at } from "@/utils/object";
import AmountChooser from "../elements/forms/AmountChooser";
import NameInput from "../elements/forms/NameInput";
import EmailInput from "../elements/forms/EmailInput";
import CheckboxInput from "../elements/forms/CheckboxInput";
import Markdown from "../elements/Markdown";
import Button from "../elements/Button";
import { makeForeignDonationRequest } from "@/utils/donation";
import { describeErrorResponse, readStrapiJson } from "@/utils/strapi";
import { withCurrency } from "@/utils/money";
import { localeOf } from "@/utils/locale";
import Modal from "../Modal";
import type { ModalData } from "../Modal";
import { useRouter } from "next/navigation";
import type {
  StrapiGlobal,
  StrapiForeignDonationSection,
} from "@/types/generated/strapi";

interface ForeignDonationSectionProps extends StrapiForeignDonationSection {
  global: StrapiGlobal;
}

export default function ForeignDonationSection(
  props: ForeignDonationSectionProps,
) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [modalData, setModalData] = useState<ModalData>({});

  function showModal(data: ModalData) {
    setModalData(data);
    setModalOpen(true);
  }

  const locale = localeOf(props.global);
  const amounts = [props.amount1, props.amount2, props.amount3];
  const amountOptions = amounts
    .filter((a): a is number => a !== null)
    .map((amount) => ({
      value: amount,
      label: withCurrency(amount, props.global.currency, locale),
    }));

  const [donation, setDonation] = useState({
    amount: amountOptions[1]?.value ?? amountOptions[0]?.value ?? 0,
    firstName: "",
    lastName: "",
    email: "",
    acceptTerms: false,
  });

  const [validity, setValidity] = useState<Record<string, boolean>>({});
  const isValid =
    at(validity, ["amount", "firstName", "lastName", "email"]).every(Boolean) &&
    donation.acceptTerms;

  const donate = async () => {
    const donationData: Record<string, unknown> = {
      firstName: donation.firstName,
      lastName: donation.lastName,
      email: donation.email,
      locale,
    };
    donationData.amount = donation.amount * 100;

    const showError = (description: string) =>
      showModal({
        icon: "error",
        title: props.global.errorText ?? "Error",
        description,
      });

    let response;
    try {
      response = await makeForeignDonationRequest(donationData);
    } catch (error) {
      // Offline, or the request never got an answer.
      showError(String(error));
      return;
    }

    if (!response.ok) {
      showError(await describeErrorResponse(response));
      return;
    }

    const data = await readStrapiJson<{ redirectURL: string }>(response);
    router.push(data.redirectURL);
  };

  return (
    <section className="flex h-full grow items-start justify-center bg-slate-200 xs:px-4 xs:py-16 sm:px-8 sm:py-32">
      <h1 className="sr-only">{props.title}</h1>
      <div className="flex w-full max-w-lg flex-col gap-4 bg-white px-4 py-24 xs:rounded-2xl xs:px-12 xs:py-12">
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => event.preventDefault()}
        >
          <h2 className="text-2xl font-bold tracking-tight text-primary-700 sm:text-3xl">
            {props.title}
          </h2>
          <Markdown className="prose w-full prose-primary">
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
        closeText={props.global.closeText ?? ""}
      />
    </section>
  );
}
