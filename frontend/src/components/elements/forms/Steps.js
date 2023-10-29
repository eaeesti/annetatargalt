import { range } from "@/utils/array";

export default function Steps({ currentStep, setStep, stepText, stepCount }) {
  return (
    <ol
      role="list"
      className="mb-4 flex w-full items-center justify-center gap-5"
    >
      {range(stepCount).map((step) => (
        <li key={step}>
          {step < currentStep && (
            <button
              type="button"
              onClick={() => setStep(step)}
              className="block h-2.5 w-2.5 rounded-full bg-primary-600 hover:bg-primary-800"
            >
              <span className="sr-only">{`${stepText} ${step + 1}`}</span>
            </button>
          )}
          {step === currentStep && (
            <button
              type="button"
              className="relative flex items-center justify-center"
              aria-current="step"
            >
              <span className="absolute flex h-5 w-5 p-px" aria-hidden="true">
                <span className="h-full w-full rounded-full bg-primary-100" />
              </span>
              <span
                className="relative block h-2.5 w-2.5 rounded-full bg-primary-600"
                aria-hidden="true"
              />
              <span className="sr-only">{`${stepText} ${step + 1}`}</span>
            </button>
          )}
          {step > currentStep && (
            <button
              type="button"
              className="block h-2.5 w-2.5 rounded-full bg-slate-300"
              disabled
            >
              <span className="sr-only">{`${stepText} ${step + 1}`}</span>
            </button>
          )}
        </li>
      ))}
    </ol>
  );
}
