import Button from "../elements/Button";

export default function CTASection({ data }) {
  return (
    <div className="text-white bg-primary-700">
      <div className="px-6 py-24 sm:px-6 sm:py-32 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            {data.title}
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-lg leading-8 text-primary-200">
            {data.subtitle}
          </p>
          <div className="flex gap-x-6 justify-center items-center mt-10">
            {data.buttons.map((button) => (
              <Button key={button.id} {...button} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
