import Button from "./elements/Button";
import Image from "./elements/Image";
import { SocialMediaIcon } from "./elements/SocialMediaIcon";
import type { StrapiGlobal } from "@/types/generated/strapi";

interface FooterProps {
  global: StrapiGlobal;
}

export default function Footer({ global }: FooterProps) {
  const { footer } = global;

  if (!footer) return;

  return (
    <footer className="bg-slate-800" aria-labelledby="footer-heading">
      <h2 id="footer-heading" className="sr-only">
        Footer
      </h2>
      <div className="mx-auto max-w-7xl px-3 pb-8 pt-16 sm:px-32 sm:pt-24 lg:px-8 lg:pt-32 xl:px-6">
        <div className="xl:grid xl:grid-cols-3 xl:gap-8">
          <div className="flex flex-col items-start gap-8 px-3">
            {footer.logo && <Image className="h-8 w-auto" data={footer.logo} />}
            <p className="text-sm leading-6 text-slate-300">{footer.text}</p>
            <div className="flex gap-4">
              {footer.socialMediaLinks.map((socialMediaLink) => (
                <Button
                  key={socialMediaLink.id}
                  href={socialMediaLink.href}
                  newTab={true}
                  size="link"
                  type="text"
                  className="text-slate-500"
                  noIcon={true}
                >
                  <SocialMediaIcon type={socialMediaLink.type} />
                </Button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 gap-x-4 gap-y-8 py-16 xs:grid-cols-2 lg:grid-cols-4 xl:col-span-2 xl:mt-0 xl:pt-0">
            {footer.columns.map((column) => (
              <div key={column.id}>
                <h3 className="px-3 pb-2.5 text-sm font-semibold uppercase leading-5 tracking-wider text-white">
                  {column.title}
                </h3>
                <ul
                  role="list"
                  className="flex flex-col items-start text-sm text-slate-200"
                >
                  {column.links.map((link) => (
                    <li key={link.id}>
                      <Button
                        text={link.text}
                        href={link.href}
                        newTab={link.newTab}
                        type="text"
                        size="md"
                        className="!justify-start !gap-0 !font-normal leading-6"
                      />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
