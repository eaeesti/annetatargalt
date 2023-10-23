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
    <div className="py-16 bg-white sm:py-24">
      <div className="px-6 mx-auto max-w-7xl lg:px-8">
        <div className="grid grid-cols-1 gap-x-8 gap-y-16 justify-center items-start mx-auto max-w-2xl sm:gap-y-24 lg:mx-0 lg:max-w-none lg:grid-cols-2">
          <div
            className={classes(
              "lg:pr-4",
              textOnRight ? "lg:order-1" : "lg:order-2"
            )}
          >
            <div className="overflow-hidden relative max-w-lg rounded-[2rem] shadow-2xl bg-slate-200">
              <Image data={image} className="object-cover w-full h-full" />
            </div>
          </div>
          <div className={textOnRight ? "lg:order-2" : "lg:order-1"}>
            <div className="text-base leading-7 text-slate-700 lg:max-w-lg">
              <h3 className="mb-6 text-xl font-bold tracking-tight text-primary-700 sm:text-2xl">
                {textOnRight} {title}
              </h3>
              <Markdown className="max-w-xl prose prose-primary">
                {text}
              </Markdown>
            </div>
            <div className="flex flex-col flex-wrap gap-3 mt-10 xs:flex-row">
              {buttons.map((button) => (
                <Button key={button.href} {...button} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
