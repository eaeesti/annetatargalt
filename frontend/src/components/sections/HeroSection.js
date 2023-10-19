import Button from "../elements/Button";

export default function HeroSection({ data }) {
  return (
    <div className="bg-white">
      <div className="isolate overflow-hidden relative pt-14 bg-gradient-to-b from-primary-100/20">
        <div
          className="absolute inset-y-0 right-1/2 -z-10 -mr-96 w-[200%] origin-top-right skew-x-[-30deg] bg-white shadow-xl shadow-primary-600/10 ring-1 ring-primary-50 sm:-mr-80 lg:-mr-96"
          aria-hidden="true"
        />
        <div className="px-6 py-32 mx-auto max-w-7xl sm:py-40 lg:px-8">
          <div className="mx-auto max-w-2xl lg:mx-0 lg:grid lg:max-w-none lg:grid-cols-2 lg:gap-x-16 lg:gap-y-6 xl:grid-cols-1 xl:grid-rows-1 xl:gap-x-8">
            <h1 className="max-w-2xl text-4xl font-bold tracking-tight text-gray-900 sm:text-6xl lg:col-span-2 xl:col-auto">
              {data.title}
            </h1>
            <div className="mt-6 max-w-xl lg:mt-0 xl:col-end-1 xl:row-start-1">
              <p className="text-lg leading-8 text-gray-600">{data.subtitle}</p>
              <div className="flex gap-x-4 items-center mt-10">
                {data.buttons.map((button) => (
                  <Button key={button.id} {...button} />
                ))}
              </div>
            </div>
            <img
              src="https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&q=80&w=2070&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D"
              alt=""
              className="mt-10 aspect-[6/5] w-full max-w-lg rounded-2xl object-cover sm:mt-16 lg:mt-0 lg:max-w-none xl:row-span-2 xl:row-end-2 xl:mt-36"
            />
          </div>
        </div>
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-white -z-10 sm:h-32" />
      </div>
    </div>
  );
}
