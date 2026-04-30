import { StrapiMapSection } from "@/types/generated/strapi";
import Map from "../elements/Map";

export default function MapSection({ title, subtitle, defaultCountry, partnerOrganizations }: StrapiMapSection) {
  if (!title) return null;

  return (
    <section className="bg-slate-50 px-4 py-12 pt-24 lg:px-8">
      <div className="container flex flex-col gap-12 lg:max-w-3xl">
        <div className="flex flex-col gap-3">
          <h2 className="inline-block max-w-full break-words text-2xl font-semibold tracking-tight text-primary-700 xs:text-2xl xs:font-bold sm:text-3xl">
            {title}
          </h2>
          {subtitle && (
            <p className="text-base text-gray-600">{subtitle}</p>
          )}
        </div>
        <Map partnerOrganizations={partnerOrganizations} defaultCountry={defaultCountry} />
        {partnerOrganizations.length > 0 && (
          <ul className="sr-only">
            {partnerOrganizations.map((org) => (
              <li key={org.id}>
                <a href={org.website ?? undefined}>{org.name} ({org.displayCountry})</a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}


