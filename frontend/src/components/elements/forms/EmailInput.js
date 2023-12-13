import { validateEmail } from "@/utils/string";
import TextInput from "./TextInput";

export default function EmailInput({
  name = "email",
  emailText,
  email,
  setEmail,
  setValidity,
  autoComplete = "email",
}) {
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
