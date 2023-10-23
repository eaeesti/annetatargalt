import Button from "./elements/Button";
import Image from "./elements/Image";
import { SocialMediaIcon } from "./elements/SocialMediaIcon";

export default function Footer({ global }) {
  const { footer } = global;

  return (
    <footer className="bg-slate-800" aria-labelledby="footer-heading">
      <h2 id="footer-heading" className="sr-only">
        Footer
      </h2>
      <div className="px-3 pt-16 pb-8 mx-auto max-w-7xl xl:px-6 sm:pt-24 sm:px-32 lg:px-8 lg:pt-32">
        <div className="xl:grid xl:grid-cols-3 xl:gap-8">
          <div className="flex flex-col gap-8 items-start px-3">
            <Image className="w-auto h-8" data={footer.logo} />
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
          <div className="grid grid-cols-1 gap-x-4 gap-y-8 py-16 xs:grid-cols-2 xl:pt-0 lg:grid-cols-4 xl:col-span-2 xl:mt-0">
            {footer.columns.map((column) => (
              <div key={column.id}>
                <h3 className="px-3 pb-2.5 text-sm font-semibold tracking-wider leading-5 text-white uppercase">
                  {column.title}
                </h3>
                <ul
                  role="list"
                  className="flex flex-col items-start text-sm text-slate-200"
                >
                  {column.links.map((link) => (
                    <li key={link.id}>
                      <Button
                        key={link.id}
                        type="text"
                        size="md"
                        className="!justify-start !font-normal leading-6 !gap-0"
                        {...link}
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
