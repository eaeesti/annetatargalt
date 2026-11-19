import type { DonationType } from "@/utils/donation-draft";

interface OptionProps {
  id: DonationType;
  label: string | null;
  donationType: DonationType;
  setDonationType: (type: DonationType) => void;
}

function Option({ id, label, donationType, setDonationType }: OptionProps) {
  return (
    // The whole label is the target: at least 44px tall for a finger.
    <label className="flex min-h-11 cursor-pointer items-center gap-2 text-base font-medium text-slate-900">
      <input
        name="donation-type"
        type="radio"
        className="h-4 w-4 cursor-pointer border-slate-400 text-primary-600 checked:border-transparent focus:ring-primary-600"
        onChange={() => setDonationType(id)}
        checked={id === donationType}
      />
      {label}
    </label>
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
    <fieldset>
      <legend className="sr-only">{label}</legend>
      <div className="flex flex-row flex-wrap gap-x-6">
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
  );
}
