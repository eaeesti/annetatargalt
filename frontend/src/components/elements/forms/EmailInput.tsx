import { validateEmail } from "@/utils/string";
import TextInput from "./TextInput";

interface EmailInputProps {
  name?: string;
  emailText: string;
  email: string;
  setEmail: (email: string) => void;
  setValidity: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  autoComplete?: string;
}

export default function EmailInput({
  name = "email",
  emailText,
  email,
  setEmail,
  setValidity,
  autoComplete = "email",
}: EmailInputProps) {
  return (
    <TextInput
      name={name}
      value={email}
      setValue={setEmail}
      setValidity={setValidity}
      isValid={(value) => validateEmail(value)}
      label={emailText}
      autoComplete={autoComplete}
      maxLength={256}
    />
  );
}
