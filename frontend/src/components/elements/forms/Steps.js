import { range } from "@/utils/array";
import { ArrowLeftIcon } from "@heroicons/react/24/solid";
import Button from "../Button";

export default function Steps({
  currentStep,
  setStep,
  stepText,
  stepCount,
  backWord,
}) {
  return (
    <div className="mb-4 flex flex-row items-center">
      {currentStep > 0 && (
        <Button
          type="text"
          size="link"
          className="hover:opacity-70"
          onClick={() => setStep(currentStep - 1)}
        >
          <span className="sr-only">{backWord}</span>
          <ArrowLeftIcon className="h-6 w-6 text-slate-600" />
        </Button>
      )}
      <ol
        role="list"
        className="flex h-6 w-full items-center justify-center gap-5"
      >
        {range(stepCount).map((step) => (
          <li key={step}>
            {step < currentStep && (
              <button
                type="button"
                onClick={() => setStep(step)}
                className="block h-2.5 w-2.5 rounded-full bg-primary-600 hover:bg-primary-800 focus-visible:outline focus-visible:outline-primary-600"
              >
                <span className="sr-only">{`${stepText} ${step + 1}`}</span>
              </button>
            )}
            {step === currentStep && (
              <button
                type="button"
                className="relative flex items-center justify-center"
                aria-current="step"
                disabled
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
      {currentStep > 0 && <div className="h-6 w-6" />}
    </div>
  );
}
