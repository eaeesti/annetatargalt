import { classes } from "@/utils/react";
import Button from "../elements/Button";
import Image from "../elements/Image";
import Markdown from "../elements/Markdown";

const stats = [
  { label: "Founded", value: "2021" },
  { label: "Employees", value: "37" },
  { label: "Countries", value: "12" },
  { label: "Raised", value: "$25M" },
];

export default function TextWithImageSection({
  title,
  text,
  image,
  buttons,
  textOnRight = true,
}) {
  return (
    <section className="bg-white py-16">
      <div className="container mt-24 w-full max-w-full sm:mt-36 sm:w-auto md:px-8 lg:mt-0 xl:max-w-7xl">
        <div
          className={classes(
            "flex flex-col items-center gap-y-8 bg-slate-50 md:rounded-[2rem]",
            textOnRight
              ? "lg:ml-48 lg:flex-row xl:ml-64"
              : "lg:mr-48 lg:flex-row-reverse xl:mr-64",
          )}
        >
          <Image
            data={image}
            className={classes(
              "mx-24 -mt-36 h-auto max-h-72 w-auto rounded-[2rem] bg-slate-200 shadow-2xl xs:-mt-48 xs:max-h-96 lg:mx-0 lg:my-16 lg:h-auto lg:max-h-none lg:w-96 xl:w-128",
              textOnRight ? "lg:-ml-48 xl:-ml-64" : "lg:-mr-48 xl:-mr-64",
            )}
          />
          <div className="flex flex-col p-4 pb-12 xs:p-8 sm:p-16 xl:p-20">
            <h3 className="mb-6 text-xl font-bold tracking-tight text-primary-700 sm:text-2xl">
              {textOnRight} {title}
            </h3>
            <Markdown className="prose prose-primary">{text}</Markdown>
            <div className="mt-10 flex flex-col flex-wrap gap-3 xs:flex-row">
              {buttons.map((button) => (
                <Button key={button.href} {...button} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
