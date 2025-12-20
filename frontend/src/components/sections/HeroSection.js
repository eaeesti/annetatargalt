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
    <header className="relative h-[56rem] max-h-[90vh] min-h-[40rem] xl:h-[90vh] xl:max-h-[96rem] xl:min-h-[44rem]">
      <Image
        data={image}
        className="absolute inset-0 -z-10 h-full w-full object-cover object-[center_75%]"
        priority
      />
      <div className="absolute inset-0 -z-10 h-full bg-primary-950/70"></div>
      <div className="mx-auto flex h-full max-w-6xl flex-col items-center  justify-center xl:items-start">
        <div className="min-h-full max-w-2xl px-4 xl:w-1/2 xl:px-0">
          <div className="flex min-h-full flex-col items-center justify-center text-center xl:items-start xl:text-left">
            <h1 className="text-4xl font-bold tracking-tight text-white [text-wrap:balance] sm:text-6xl">
              {title}
            </h1>
            <p className="mt-6 text-slate-200 [text-wrap:balance] sm:text-lg sm:leading-8">
              {subtitle}
            </p>
            <div className="mt-10 flex w-full max-w-xs flex-col items-stretch justify-center gap-4 text-white xs:max-w-none xs:flex-row xs:items-center xl:justify-start">
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
