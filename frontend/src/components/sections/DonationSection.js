"use client";

import { useState } from "react";
import { pick } from "@/utils/object";
import AmountChooser from "../elements/forms/AmountChooser";
import DonationTypeChooser from "../elements/forms/DonationTypeChooser";
import Button from "../elements/Button";
import Steps from "../elements/forms/Steps";
import NameInput from "../elements/forms/NameInput";
import EmailInput from "../elements/forms/EmailInput";
import IdCodeInput from "../elements/forms/IdCodeInput";
import { formatEstonianAmount } from "@/utils/estonia";
import CheckboxInput from "../elements/forms/CheckboxInput";

export default function DonationSection(props) {
  const amounts = pick(props, ["amount1", "amount2", "amount3"]);
  const amountOptions = amounts.map((amount) => ({
    value: amount,
    label: `${amount}${props.currency}`,
  }));

  const [donation, setDonation] = useState({
    amount: amountOptions[1].value,
    type: "recurring",
    firstName: "",
    lastName: "",
    email: "",
    idCode: "",
    acceptTerms: false,
  });

  const [validity, setValidity] = useState({});
  const stageValidity = {
    0: pick(validity, ["amount"]).every(Boolean),
    1: pick(validity, ["firstName", "lastName", "email", "idCode"]).every(
      Boolean,
    ),
    2: donation.acceptTerms,
  };

  const [stage, setStage] = useState(0);

  return (
    <section className="flex h-full flex-grow items-start justify-center bg-slate-200 xs:px-4 xs:py-16 sm:px-8 sm:py-32">
      <h1 className="sr-only">{props.page.metadata.title}</h1>
      <div className="flex w-full max-w-lg flex-col gap-4 bg-white px-4 py-24 xs:rounded-2xl xs:px-12 xs:py-12">
        <Steps
          currentStep={stage}
          setStep={setStage}
          stepText={props.stepText}
          stepCount={3}
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
              currency={props.currency}
              setValidity={setValidity}
            />
            <Button
              text={props.nextButtonText}
              type="primary"
              size="md"
              onClick={() => setStage(1)}
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
              setLastName={(lastName) => setDonation({ ...donation, lastName })}
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
              idCode={donation.idCode}
              setIdCode={(idCode) => setDonation({ ...donation, idCode })}
              setValidity={setValidity}
            />
            <Button
              text={props.nextButtonText}
              type="primary"
              size="lg"
              onClick={() => setStage(2)}
              disabled={!stageValidity[1]}
              buttonType="submit"
              className="mt-4"
            />
          </form>
        )}
        {stage === 2 && (
          <form
            className="flex flex-col gap-4"
            onSubmit={(event) => event.preventDefault()}
          >
            <h2 className="text-2xl font-bold tracking-tight text-primary-700 sm:text-3xl">
              {props.confirmText}
            </h2>
            <pre className="text-lg text-slate-700">
              {JSON.stringify(donation, null, 2)}
            </pre>
            <p className="text-slate-700">
              Annetad{" "}
              <span className="font-semibold text-primary-700">
                {formatEstonianAmount(donation.amount)}
                {props.currency}
              </span>{" "}
              efektiivsetele heategevustele.
            </p>
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
              onClick={() => console.log(donation)}
              disabled={!stageValidity[2]}
              buttonType="submit"
              className="mt-4"
            />
          </form>
        )}
      </div>
    </section>
  );
}
