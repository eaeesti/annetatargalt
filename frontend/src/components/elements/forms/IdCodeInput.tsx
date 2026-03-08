import { validateIdCode } from "@/utils/estonia";
import TextInput from "./TextInput";

interface IdCodeInputProps {
  idCodeText: string | null;
  idCodeDescription?: string | null;
  idCode: string;
  setIdCode: (idCode: string) => void;
  setValidity: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
}

export default function IdCodeInput({
  idCodeText,
  idCodeDescription,
  idCode,
  setIdCode,
  setValidity,
}: IdCodeInputProps) {
  return (
    <TextInput
      name="idCode"
      value={idCode}
      setValue={setIdCode}
      setValidity={setValidity}
      isValid={(value) => value === "" || validateIdCode(value)}
      label={idCodeText}
      autoComplete="isikukood"
      maxLength={11}
      description={idCodeDescription}
    />
  );
}
