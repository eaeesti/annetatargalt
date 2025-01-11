"use client";

import { useState } from "react";
import { at, pick } from "@/utils/object";
import AmountChooser from "../elements/forms/AmountChooser";
import DonationTypeChooser from "../elements/forms/DonationTypeChooser";
import Button from "../elements/Button";
import Steps from "../elements/forms/Steps";
import NameInput from "../elements/forms/NameInput";
import EmailInput from "../elements/forms/EmailInput";
import IdCodeInput from "../elements/forms/IdCodeInput";
import { formatEstonianAmount } from "@/utils/estonia";
import CheckboxInput from "../elements/forms/CheckboxInput";
import { makeDonationRequest } from "@/utils/donation";
import { useRouter, useSearchParams } from "next/navigation";
import BankChooser from "../elements/forms/BankChooser";
import Markdown from "../elements/Markdown";
import { format } from "@/utils/string";
import OrganizationChooser from "../elements/forms/OrganizationChooser";
import Proportions from "@/utils/proportions";
import PaymentSummary from "../elements/forms/PaymentSummary";
import Modal from "../Modal";
import CompanyInput from "../elements/forms/CompanyInput";
import DedicationInput from "../elements/forms/DedicationInput";
import { GCEvent } from "next-goatcounter";

export default function DonationSection(props) {
  const router = useRouter();
  const searchParams = useSearchParams();

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
  const typeParam = searchParams.get("type");
  const orgParam = Number(searchParams.get("org"));

  const [donation, setDonation] = useState({
    amount: amountOptions[1].value,
    type: typeParam === "onetime" ? "onetime" : "recurring",
    firstName: "",
    lastName: "",
    email: "",
    idCode: "",
    bank: "",
    companyDonation: false,
    companyName: "",
    companyCode: "",
    dedicateDonation: false,
    dedicationName: "",
    dedicationEmail: "",
    dedicationMessage: "",
    proportions: Proportions.fromStrapiData(props.causes.data, orgParam),
    addTip: false,
    acceptTerms: false,
  });

  const [validity, setValidity] = useState({});
  const stageValidity = {
    0: at(validity, ["amount"]).every(Boolean),
    1: at(validity, [
      "firstName",
      "lastName",
      "email",
      "idCode",
      "company",
      "dedication",
    ]).every(Boolean),
    2:
      donation.acceptTerms &&
      (donation.type === "recurring" ? donation.bank : true),
  };

  const [stage, setStage] = useState(0);
  const [donated, setDonated] = useState(false);

  const tipAmount = donation.addTip
    ? Math.round(0.05 * donation.amount * 100) / 100
    : 0;
  const totalAmount = Math.round((donation.amount + tipAmount) * 100) / 100;

  const donate = async () => {
    const donationData = pick(donation, [
      "amount",
      "type",
      "firstName",
      "lastName",
      "email",
      "idCode",
      "bank",
      "proportions",
    ]);
    if (donation.companyDonation) {
      donationData.companyName = donation.companyName;
      donationData.companyCode = donation.companyCode;
    }
    if (donation.dedicateDonation && donation.type === "onetime") {
      donationData.dedicationName = donation.dedicationName;
      donationData.dedicationEmail = donation.dedicationEmail;
      donationData.dedicationMessage = donation.dedicationMessage;
    }

    const response = await makeDonationRequest(donation);
    const data = await response.json();

    if (response.ok) {
      if (data.redirectURL) {
        router.push(data.redirectURL);
      } else {
        setDonated(true);
      }
    } else {
      showModal({
        icon: "error",
        title: props.global.errorText,
        description: `${data.error.name}: ${data.error.message}`,
      });
    }
  };

  const summaryText =
    donation.type === "recurring"
      ? props.recurringDonationSummary
      : props.oneTimeDonationSummary;

  return (
    <section className="flex h-full flex-grow items-start justify-center bg-slate-200 xs:px-4 xs:py-16 sm:px-8 sm:py-32">
      <h1 className="sr-only">{props.page.metadata.title}</h1>
      {!donated && (
        <div className="flex w-full max-w-lg flex-col gap-4 bg-white px-4 py-24 xs:rounded-2xl xs:px-12 xs:py-12">
          <Steps
            currentStep={stage}
            setStep={setStage}
            stepText={props.stepText}
            stepCount={4}
            backWord={props.global.backWord}
          />
          {stage === 0 && (
            <form
              className="flex flex-col gap-4"
              onSubmit={(event) => event.preventDefault()}
            >
              <h2 className="text-2xl font-bold tracking-tight text-primary-700 sm:text-3xl">
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
                currency={props.global.currency}
                setValidity={setValidity}
              />
              <OrganizationChooser
                chooseOrganizationsText={props.chooseOrganizationsText}
                informationText={props.informationText}
                lockText={props.lockText}
                letExpertsChooseText={props.letExpertsChooseText}
                causes={props.causes}
                proportions={donation.proportions}
                setProportions={(proportions) =>
                  setDonation({ ...donation, proportions })
                }
              />
              <Button
                text={props.nextButtonText}
                type="primary"
                size="md"
                onClick={() => {
                  GCEvent("donation-info-stage");
                  setStage(1);
                }}
                disabled={!stageValidity[0]}
                buttonType="submit"
                className="mt-4"
              />
            </form>
          )}
          {stage === 1 && (
            <form
              className="flex flex-col gap-4"
              onSubmit={(event) => event.preventDefault()}
            >
              <h2 className="text-2xl font-bold tracking-tight text-primary-700 sm:text-3xl">
                {props.detailsText}
              </h2>
              <NameInput
                firstNameText={props.firstNameText}
                lastNameText={props.lastNameText}
                firstName={donation.firstName}
                lastName={donation.lastName}
                setFirstName={(firstName) =>
                  setDonation({ ...donation, firstName })
                }
                setLastName={(lastName) =>
                  setDonation({ ...donation, lastName })
                }
                setValidity={setValidity}
              />
              <EmailInput
                emailText={props.emailText}
                email={donation.email}
                setEmail={(email) => setDonation({ ...donation, email })}
                setValidity={setValidity}
              />
              <IdCodeInput
                idCodeText={props.idCodeText}
                idCodeDescription={props.idCodeDescription}
                idCode={donation.idCode}
                setIdCode={(idCode) => setDonation({ ...donation, idCode })}
                setValidity={setValidity}
              />
              <CompanyInput
                donateAsCompanyText={props.donateAsCompanyText}
                companyDonation={donation.companyDonation}
                setCompanyDonation={(companyDonation) =>
                  setDonation({ ...donation, companyDonation })
                }
                companyNameText={props.companyNameText}
                companyName={donation.companyName}
                setCompanyName={(companyName) =>
                  setDonation({ ...donation, companyName })
                }
                companyCodeText={props.companyCodeText}
                companyCode={donation.companyCode}
                setCompanyCode={(companyCode) =>
                  setDonation({ ...donation, companyCode })
                }
                setValidity={setValidity}
              />
              {donation.type === "onetime" && (
                <DedicationInput
                  dedicateDonationText={props.dedicateDonationText}
                  dedicateDonation={donation.dedicateDonation}
                  setDedicateDonation={(dedicateDonation) =>
                    setDonation({ ...donation, dedicateDonation })
                  }
                  dedicationNameText={props.dedicationNameText}
                  dedicationName={donation.dedicationName}
                  setDedicationName={(dedicationName) =>
                    setDonation({ ...donation, dedicationName })
                  }
                  dedicationEmailText={props.dedicationEmailText}
                  dedicationEmail={donation.dedicationEmail}
                  setDedicationEmail={(dedicationEmail) =>
                    setDonation({ ...donation, dedicationEmail })
                  }
                  dedicationMessageText={props.dedicationMessageText}
                  dedicationMessage={donation.dedicationMessage}
                  setDedicationMessage={(dedicationMessage) =>
                    setDonation({ ...donation, dedicationMessage })
                  }
                  setValidity={setValidity}
                />
              )}
              <Button
                text={props.nextButtonText}
                type="primary"
                size="lg"
                onClick={() => {
                  GCEvent("donation-support-stage");
                  setStage(2);
                }}
                disabled={!stageValidity[1]}
                buttonType="submit"
                className="mt-4"
              />
            </form>
          )}
          {stage === 2 && (
            <form
              className="flex flex-col gap-6"
              onSubmit={(event) => event.preventDefault()}
            >
              <h2 className="text-2xl font-bold tracking-tight text-primary-700 sm:text-3xl">
                {props.tipTitle}
              </h2>
              <Markdown className="prose prose-primary w-full">
                {props.tipText}
              </Markdown>
              <CheckboxInput
                name="tip"
                label={props.tipCheckboxText}
                value={donation.addTip}
                setValue={(addTip) => setDonation({ ...donation, addTip })}
              />
              <Button
                text={props.nextButtonText}
                type="primary"
                size="lg"
                onClick={() => {
                  GCEvent("donation-summary-stage");
                  setStage(3);
                }}
                buttonType="submit"
                className=""
              />
            </form>
          )}
          {stage === 3 && (
            <form
              className="flex flex-col gap-6"
              onSubmit={(event) => event.preventDefault()}
            >
              <h2 className="text-2xl font-bold tracking-tight text-primary-700 sm:text-3xl">
                {props.confirmText}
              </h2>
              <Markdown className="prose prose-primary w-full [&>p>strong]:text-primary-700">
                {summaryText}
              </Markdown>
              <PaymentSummary
                donation={donation}
                causes={props.causes}
                currency={props.global.currency}
                totalText={props.global.totalText}
                tipOrganization={props.global.tipOrganization}
                tipAmount={tipAmount}
                totalAmount={totalAmount}
              />
              {donation.type === "recurring" && (
                <BankChooser
                  bankText={props.bankText}
                  otherBankText={props.otherBankText}
                  banks={props.banks}
                  bank={donation.bank}
                  setBank={(bank) => setDonation({ ...donation, bank })}
                />
              )}
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
                onClick={() => {
                  GCEvent("donation-clicked");
                  donate();
                }}
                disabled={!stageValidity[2]}
                buttonType="submit"
                className="mt-4"
              />
            </form>
          )}
        </div>
      )}
      {donated && (
        <div className="flex max-w-lg flex-col gap-4 bg-white px-4 py-24 xs:rounded-2xl xs:px-12 xs:py-12 ">
          <Markdown className="prose prose-primary w-full">
            {format(props.recurringDonationGuide, {
              amount: formatEstonianAmount(totalAmount) + props.global.currency,
            })}
          </Markdown>
        </div>
      )}
      <Modal
        open={modalOpen}
        data={modalData}
        setOpen={setModalOpen}
        closeText={props.global.closeText}
      />
    </section>
  );
}
