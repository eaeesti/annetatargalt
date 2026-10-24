import Button from "../elements/Button";
import Image from "../elements/Image";
import type { StrapiHeroSection } from "@/types/generated/strapi";

/** Which part of the image stays in view when the hero crops it. */
const POSITIONS = {
  top: "object-top",
  upper: "object-[center_25%]",
  center: "object-center",
  lower: "object-[center_75%]",
  bottom: "object-bottom",
} as const;

export default function HeroSection({
  title,
  subtitle,
  buttons,
  image,
  imagePosition,
}: StrapiHeroSection) {
  return (
    <header className="relative h-224 max-h-[90vh] min-h-160 xl:h-[90vh] xl:max-h-384 xl:min-h-176">
      <Image
        data={image}
        className={`absolute inset-0 -z-10 h-full w-full object-cover ${POSITIONS[imagePosition ?? "lower"]}`}
        priority
      />
      <div className="absolute inset-0 -z-10 h-full bg-primary-950/70"></div>
      <div className="mx-auto flex h-full max-w-6xl flex-col items-center justify-center xl:items-start">
        <div className="min-h-full max-w-2xl px-4 xl:w-1/2 xl:px-0">
          <div className="flex min-h-full flex-col items-center justify-center text-center xl:items-start xl:text-left">
            <h1 className="text-4xl font-bold tracking-tight text-balance text-white sm:text-6xl">
              {title}
            </h1>
            <p className="mt-6 text-balance text-slate-200 sm:text-lg sm:leading-8">
              {subtitle}
            </p>
            <div className="mt-10 flex w-full max-w-xs flex-col items-stretch justify-center gap-4 text-white xs:max-w-none xs:flex-row xs:items-center xl:justify-start">
              {buttons.map((button) => (
                <Button
                  key={button.id}
                  text={button.text}
                  type={button.type}
                  size={button.size}
                  href={button.href}
                  arrow={button.arrow}
                  newTab={button.newTab}
                  plausibleEvent={button.plausibleEvent}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
