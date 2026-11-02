import type { DonationType } from "@/utils/donation-draft";

interface OptionProps {
  id: DonationType;
  label: string | null;
  donationType: DonationType;
  setDonationType: (type: DonationType) => void;
}

function Option({ id, label, donationType, setDonationType }: OptionProps) {
  return (
    <div className="flex cursor-pointer! items-center gap-2">
      <input
        id={id}
        name="donation-type"
        type="radio"
        className="h-4 w-4 cursor-pointer border-slate-300 text-primary-600 checked:border-transparent focus:ring-primary-600"
        onChange={() => setDonationType(id)}
        checked={id === donationType}
      />
      <label
        htmlFor={id}
        className="block cursor-pointer text-sm leading-6 font-medium text-slate-900"
      >
        {label}
      </label>
    </div>
  );
}

interface DonationTypeChooserProps {
  donationType: DonationType;
  setDonationType: (type: DonationType) => void;
  label: string | null;
  recurringDonationText: string | null;
  singleDonationText: string | null;
}

export default function DonationTypeChooser({
  donationType,
  setDonationType,
  label,
  recurringDonationText,
  singleDonationText,
}: DonationTypeChooserProps) {
  return (
    <div>
      <fieldset>
        <legend className="sr-only">{label}</legend>
        <div className="flex flex-row gap-6">
          <Option
            id="recurring"
            label={recurringDonationText}
            donationType={donationType}
            setDonationType={setDonationType}
          />
          <Option
            id="onetime"
            label={singleDonationText}
            donationType={donationType}
            setDonationType={setDonationType}
          />
        </div>
      </fieldset>
    </div>
  );
}
