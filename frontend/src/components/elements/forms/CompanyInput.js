import { useEffect, useState } from "react";
import CheckboxInput from "./CheckboxInput";
import TextInput from "./TextInput";

export default function CompanyInput({
  donateAsCompanyText,
  companyDonation,
  setCompanyDonation,
  companyNameText,
  companyName,
  setCompanyName,
  companyCodeText,
  companyCode,
  setCompanyCode,
  setValidity,
}) {
  const [companyValidity, setCompanyValidity] = useState({});

  useEffect(() => {
    if (!companyDonation) {
      setValidity((ready) => ({ ...ready, company: true }));
    } else {
      const companyValid =
        Boolean(companyValidity.companyName) &&
        Boolean(companyValidity.companyCode);
      setValidity((ready) => ({ ...ready, company: companyValid }));
    }
  }, [companyDonation, companyName, companyCode, companyValidity]);

  return (
    <>
      <CheckboxInput
        name="companyDonation"
        label={donateAsCompanyText}
        value={companyDonation}
        setValue={(companyDonation) => setCompanyDonation(companyDonation)}
      />
      {companyDonation && (
        <>
          <TextInput
            name="companyName"
            value={companyName}
            setValue={setCompanyName}
            setValidity={setCompanyValidity}
            isValid={(value) => value !== ""}
            label={companyNameText}
            autoComplete="company-name"
            maxLength={128}
          />
          <TextInput
            name="companyCode"
            value={companyCode}
            setValue={setCompanyCode}
            setValidity={setCompanyValidity}
            isValid={(value) => value !== ""}
            label={companyCodeText}
            autoComplete="company-registry-code"
            maxLength={128}
          />
        </>
      )}
    </>
  );
}
