import { useEffect, useState } from "react";
import CheckboxInput from "./CheckboxInput";
import TextInput from "./TextInput";
import EmailInput from "./EmailInput";
import TextareaInput from "./TextareaInput";

export default function DedicationInput({
  dedicateDonationText,
  dedicateDonation,
  setDedicateDonation,
  dedicationNameText,
  dedicationName,
  setDedicationName,
  dedicationEmailText,
  dedicationEmail,
  setDedicationEmail,
  dedicationMessageText,
  dedicationMessage,
  setDedicationMessage,
  setValidity,
}) {
  const [dedicationValidity, setDedicationValidity] = useState({});

  useEffect(() => {
    if (!dedicateDonation) {
      setValidity((ready) => ({ ...ready, dedication: true }));
    } else {
      const dedicationValid =
        Boolean(dedicationValidity.dedicationName) &&
        Boolean(dedicationValidity.dedicationEmail);
      setValidity((ready) => ({ ...ready, dedication: dedicationValid }));
    }
  }, [dedicateDonation, dedicationName, dedicationEmail, dedicationValidity]);

  return (
    <>
      <CheckboxInput
        name="dedicateDonation"
        label={dedicateDonationText}
        value={dedicateDonation}
        setValue={(dedicateDonation) => setDedicateDonation(dedicateDonation)}
      />
      {dedicateDonation && (
        <>
          <TextInput
            name="dedicationName"
            value={dedicationName}
            setValue={setDedicationName}
            setValidity={setDedicationValidity}
            isValid={(value) => value !== ""}
            label={dedicationNameText}
            maxLength={128}
          />
          <EmailInput
            name="dedicationEmail"
            email={dedicationEmail}
            setEmail={setDedicationEmail}
            setValidity={setDedicationValidity}
            emailText={dedicationEmailText}
          />
          <TextareaInput
            name="dedicationMessage"
            value={dedicationMessage}
            setValue={setDedicationMessage}
            setValidity={setDedicationValidity}
            isValid={() => true}
            label={dedicationMessageText}
            maxLength={1024}
            rows={4}
          />
        </>
      )}
    </>
  );
}
