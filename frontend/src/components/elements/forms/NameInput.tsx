import TextInput from "./TextInput";

interface NameInputProps {
  firstNameText: string | null;
  lastNameText: string | null;
  firstName: string;
  lastName: string;
  setFirstName: (name: string) => void;
  setLastName: (name: string) => void;
  setValidity: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  /** Side by side on narrow screens too, to save height. */
  sideBySide?: boolean;
  /** Puts the cursor in the first name; off where the step starts higher up. */
  autoFocus?: boolean;
}

export default function NameInput({
  firstNameText,
  lastNameText,
  firstName,
  lastName,
  setFirstName,
  setLastName,
  setValidity,
  sideBySide = false,
  autoFocus = true,
}: NameInputProps) {
  return (
    <div
      className={
        sideBySide
          ? "grid grid-cols-2 gap-3 sm:gap-4"
          : "grid grid-cols-1 gap-4 sm:grid-cols-2"
      }
    >
      <TextInput
        name="firstName"
        value={firstName}
        setValue={setFirstName}
        setValidity={setValidity}
        isValid={(value) => value !== ""}
        label={firstNameText}
        autoComplete="given-name"
        maxLength={128}
        autoFocus={autoFocus}
      />
      <TextInput
        name="lastName"
        value={lastName}
        setValue={setLastName}
        setValidity={setValidity}
        isValid={(value) => value !== ""}
        label={lastNameText}
        autoComplete="family-name"
        maxLength={128}
      />
    </div>
  );
}
