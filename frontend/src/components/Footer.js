import Image from "./elements/Image";
import { SocialMediaIcon } from "./elements/SocialMediaIcon";

export default function Footer({ global }) {
  const { footer } = global;

  return (
    <footer className="bg-slate-800" aria-labelledby="footer-heading">
      <h2 id="footer-heading" className="sr-only">
        Footer
      </h2>
      <div className="px-6 pt-16 pb-8 mx-auto max-w-7xl sm:pt-24 sm:px-32 lg:px-8 lg:pt-32">
        <div className="xl:grid xl:grid-cols-3 xl:gap-8">
          <div className="space-y-8">
            <Image className="w-auto h-8" data={footer.logo} />
            <p className="text-sm leading-6 text-slate-300">{footer.text}</p>
            <div className="flex space-x-6">
              {footer.socialMediaLinks.map((socialMediaLink) => (
                <a
                  key={socialMediaLink.id}
                  href={socialMediaLink.href}
                  className="text-slate-500 hover:text-slate-400"
                >
                  <span className="sr-only">{socialMediaLink.type}</span>
                  <SocialMediaIcon {...socialMediaLink} />
                </a>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-8 py-16 xl:pt-0 lg:grid-cols-4 xl:col-span-2 xl:mt-0">
            {footer.columns.map((column) => (
              <div key={column.id}>
                <h3 className="text-sm font-semibold tracking-wider leading-5 text-white uppercase">
                  {column.title}
                </h3>
                <ul role="list" className="mt-4 space-y-4">
                  {column.links.map((link) => (
                    <li key={link.id}>
                      <a
                        href={link.href}
                        className="text-sm leading-6 text-slate-300 hover:text-white"
                      >
                        {link.text}
                      </a>
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
