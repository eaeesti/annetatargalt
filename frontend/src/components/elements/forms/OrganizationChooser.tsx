import LockedIcon from "@/components/icons/LockedIcon";
import Slider from "./Slider";
import UnlockedIcon from "@/components/icons/UnlockedIcon";
import { classes } from "@/utils/react";
import { Disclosure } from "@headlessui/react";
import { ChevronUpIcon } from "@heroicons/react/24/solid";
import Button from "../Button";
import InfoIcon from "@/components/icons/InfoIcon";
import CheckboxInput from "./CheckboxInput";
import type { StrapiCause } from "@/types/generated/strapi";
import Proportions from "@/utils/proportions";

interface ProportionSliderProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onMouseUp" | "min" | "max"> {
  lockText: string;
  proportion: number;
  setProportion: (value: number) => void;
  isLocked: boolean;
  lock: () => void;
  toggleLock: () => void;
  onMouseUp?: () => void;
}

function ProportionSlider({
  lockText,
  proportion,
  setProportion,
  isLocked,
  lock,
  toggleLock,
  ...props
}: ProportionSliderProps) {
  return (
    <div className="flex w-full flex-row gap-4">
      <Slider
        value={proportion}
        setValue={setProportion}
        onMouseUp={() => lock()}
        {...props}
      />
      <span
        className={classes(
          proportion === 0 ? "opacity-30" : "",
          "w-16 text-center text-lg font-medium",
        )}
      >
        {proportion}%
      </span>
      <button
        className="cursor-pointer text-primary-700 hover:opacity-70"
        onClick={() => toggleLock()}
      >
        <span className="sr-only">{lockText}</span>
        {isLocked ? <LockedIcon /> : <UnlockedIcon />}
      </button>
    </div>
  );
}

interface OrganizationChooserProps {
  lockText: string;
  chooseOrganizationsText: string;
  informationText: string;
  letExpertsChooseText: string;
  causes: { data: StrapiCause[] };
  proportions: Proportions;
  setProportions: (proportions: Proportions) => void;
}

export default function OrganizationChooser({
  lockText,
  chooseOrganizationsText,
  informationText,
  letExpertsChooseText,
  causes,
  proportions,
  setProportions,
}: OrganizationChooserProps) {
  return (
    <fieldset>
      <legend className="my-6 block text-xl font-semibold leading-6 tracking-tight text-primary-700 ">
        {chooseOrganizationsText}
      </legend>
      <div className="flex flex-col gap-10">
        {causes.data.map((cause, causeIndex) => (
          <Disclosure key={causeIndex}>
            {({ open }) => (
              <div className="flex flex-col gap-4">
                <div className="flex flex-row items-center gap-3">
                  <Disclosure.Button className="flex flex-row items-center gap-3 hover:opacity-70">
                    <ChevronUpIcon
                      className={classes(
                        open ? "" : "rotate-180",
                        "h-6 w-6 text-slate-400",
                      )}
                    />
                    <label
                      id={`cause${cause.id}`}
                      className="text-md cursor-pointer font-medium"
                    >
                      {cause.title}
                    </label>
                  </Disclosure.Button>
                  <Button
                    href={`/${cause.slug}`}
                    newTab={true}
                    size="link"
                    type="text"
                    noIcon={true}
                    className="text-primary-700"
                    title={informationText}
                  >
                    <span className="sr-only">{informationText}</span>
                    <InfoIcon />
                  </Button>
                </div>
                <ProportionSlider
                  lockText={lockText}
                  proportion={proportions.getProportion(cause.id)}
                  setProportion={(value) =>
                    setProportions(
                      proportions.updateProportion(cause.id, value),
                    )
                  }
                  isLocked={proportions.isLocked(cause.id)}
                  lock={() =>
                    setProportions(proportions.lockProportion(cause.id))
                  }
                  toggleLock={() =>
                    setProportions(proportions.toggleProportionLock(cause.id))
                  }
                  aria-labelledby={`cause${cause.id}`}
                />
                <Disclosure.Panel className="flex w-full flex-col gap-6  rounded-xl bg-slate-50 px-6 py-8 shadow-lg shadow-slate-200">
                  <CheckboxInput
                    name={`cause${cause.id}fund`}
                    value={proportions.goesToFund(cause.id) ?? false}
                    setValue={() =>
                      setProportions(proportions.toggleToFund(cause.id))
                    }
                    label={letExpertsChooseText}
                    labelSize="sm"
                  />
                  <div
                    className={classes(
                      proportions.goesToFund(cause.id)
                        ? "pointer-events-none cursor-default select-none opacity-20"
                        : "",
                      "flex flex-col gap-6",
                    )}
                  >
                    {cause.organizations.map(
                      (organization, organizationIndex) => (
                        <div
                          key={organizationIndex}
                          className="flex flex-col gap-4"
                        >
                          <div className="flex flex-row items-center gap-3">
                            <label
                              id={`organization${organization.internalId}`}
                              className="cursor-text text-sm font-medium"
                            >
                              {organization.title}
                            </label>
                            <Button
                              href={`/${cause.slug}/${organization.slug}`}
                              newTab={true}
                              size="link"
                              type="text"
                              noIcon={true}
                              className="text-primary-700"
                              title={informationText}
                            >
                              <span className="sr-only">{informationText}</span>
                              <InfoIcon />
                            </Button>
                          </div>
                          <ProportionSlider
                            lockText={lockText}
                            proportion={proportions.getSubProportion(
                              cause.id,
                              organization.internalId!,
                            )}
                            setProportion={(value) =>
                              setProportions(
                                proportions.updateSubProportion(
                                  cause.id,
                                  organization.internalId!,
                                  value,
                                ),
                              )
                            }
                            isLocked={proportions.isSubLocked(
                              cause.id,
                              organization.internalId!,
                            )}
                            lock={() =>
                              setProportions(
                                proportions.lockSubProportion(
                                  cause.id,
                                  organization.internalId!,
                                ),
                              )
                            }
                            toggleLock={() =>
                              setProportions(
                                proportions.toggleSubProportionLock(
                                  cause.id,
                                  organization.internalId!,
                                ),
                              )
                            }
                            aria-labelledby={`organization${organization.internalId}`}
                            disabled={proportions.goesToFund(cause.id) ?? false}
                          />
                        </div>
                      ),
                    )}
                  </div>
                </Disclosure.Panel>
              </div>
            )}
          </Disclosure>
        ))}
      </div>
    </fieldset>
  );
}
