import Button from "../elements/Button";
import Image from "../elements/Image";

export default function HeroSection({
  title,
  subtitle,
  buttons,
  image,
  mobileImage,
}) {
  return (
    <header class="relative h-[56rem] max-h-[90vh] min-h-[40rem] xl:h-[90vh] xl:max-h-[96rem] xl:min-h-[44rem]">
      <Image
        data={image}
        className="absolute inset-0 -z-10 hidden h-full w-full object-cover object-[center_75%] xl:block"
      />
      <Image
        data={mobileImage}
        className="absolute inset-0 -z-10 h-full w-full object-cover object-[center_80%] xl:hidden"
      />
      <div class="absolute inset-0 -z-10 h-full bg-primary-900/70 xl:bg-transparent xl:bg-gradient-to-br xl:xl:from-primary-700/50 xl:from-20% xl:to-transparent"></div>
      <div class="mx-auto flex h-full max-w-6xl flex-col items-center  justify-center xl:items-start">
        <div class="min-h-full max-w-2xl px-4 xl:w-1/2 xl:px-0">
          <div class="flex min-h-full flex-col items-center justify-center text-center xl:items-start xl:text-left">
            <h1 class="text-4xl font-bold tracking-tight text-white [text-wrap:balance] sm:text-6xl">
              {title}
            </h1>
            <p class="mt-6 text-slate-200 [text-wrap:balance] sm:text-lg sm:leading-8">
              {subtitle}
            </p>
            <div class="mt-10 flex w-full max-w-xs flex-col items-stretch justify-center gap-4 text-white xs:max-w-none xs:flex-row xs:items-center xl:justify-start">
              {buttons.map((button) => (
                <Button key={button.id} {...button} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
