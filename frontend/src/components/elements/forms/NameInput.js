import TextInput from "./TextInput";

export default function NameInput({
  firstNameText,
  lastNameText,
  firstName,
  lastName,
  setFirstName,
  setLastName,
  setValidity,
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <TextInput
        name="firstName"
        value={firstName}
        setValue={setFirstName}
        setValidity={setValidity}
        isValid={(value) => value !== ""}
        label={firstNameText}
        autoComplete="given-name"
        maxLength={128}
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
