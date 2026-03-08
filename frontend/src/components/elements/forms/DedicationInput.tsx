import { useEffect, useState } from "react";
import CheckboxInput from "./CheckboxInput";
import TextInput from "./TextInput";
import EmailInput from "./EmailInput";
import TextareaInput from "./TextareaInput";

interface DedicationInputProps {
  dedicateDonationText: string | null;
  dedicateDonation: boolean;
  setDedicateDonation: (val: boolean) => void;
  dedicationNameText: string | null;
  dedicationName: string;
  setDedicationName: (name: string) => void;
  dedicationEmailText: string | null;
  dedicationEmail: string;
  setDedicationEmail: (email: string) => void;
  dedicationMessageText: string | null;
  dedicationMessage: string;
  setDedicationMessage: (message: string) => void;
  setValidity: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
}

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
}: DedicationInputProps) {
  const [dedicationValidity, setDedicationValidity] = useState<Record<string, boolean>>({});

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
