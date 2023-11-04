import { validateEmail } from "@/utils/string";
import TextInput from "./TextInput";

export default function EmailInput({
  emailText,
  email,
  setEmail,
  setValidity,
}) {
  return (
    <TextInput
      name="email"
      value={email}
      setValue={setEmail}
      setValidity={setValidity}
      isValid={(value) => validateEmail(value)}
      label={emailText}
      autoComplete="email"
      maxLength={256}
    />
  );
}
