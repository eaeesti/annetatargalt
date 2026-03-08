interface OptionProps {
  id: string;
  label: string | null;
  paymentMethod: string;
  setPaymentMethod: (method: string) => void;
}

function Option({ id, label, paymentMethod, setPaymentMethod }: OptionProps) {
  return (
    <div className="flex !cursor-pointer items-center gap-2">
      <input
        id={id}
        name="payment-method"
        type="radio"
        className="h-4 w-4 cursor-pointer border-slate-300 text-primary-600 focus:ring-primary-600"
        onChange={() => setPaymentMethod(id)}
        checked={id === paymentMethod}
      />
      <label
        htmlFor={id}
        className="block cursor-pointer text-sm font-medium leading-6  text-slate-900"
      >
        {label}
      </label>
    </div>
  );
}

interface PaymentMethodChooserProps {
  paymentMethod: string;
  setPaymentMethod: (method: string) => void;
  label: string | null;
  paymentInitiationText: string | null;
  cardPaymentsText: string | null;
}

export default function PaymentMethodChooser({
  paymentMethod,
  setPaymentMethod,
  label,
  paymentInitiationText,
  cardPaymentsText,
}: PaymentMethodChooserProps) {
  return (
    <fieldset aria-labelledby="paymentMethodLabel">
      <div className="flex flex-row gap-4">
        <legend
          id="paymentMethodLabel"
          className="text-sm font-medium leading-6 text-slate-900"
        >
          {label}:
        </legend>
        <div className="flex flex-row gap-4">
          <Option
            id="paymentInitiation"
            label={paymentInitiationText}
            paymentMethod={paymentMethod}
            setPaymentMethod={setPaymentMethod}
          />
          <Option
            id="cardPayments"
            label={cardPaymentsText}
            paymentMethod={paymentMethod}
            setPaymentMethod={setPaymentMethod}
          />
        </div>
      </div>
    </fieldset>
  );
}
