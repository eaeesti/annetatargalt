"use client";

import { useState } from "react";
import { ComposableMap, Geographies, Geography } from "react-simple-maps";
import type { StrapiPartnerOrganization } from "@/types/generated/strapi";
import Anchor from "./Anchor";
import { classes } from "@/utils/react";

// Served from public/, not from a CDN. connect-src in next.config.mjs allows
// 'self' and the Strapi origin and nothing else, so fetching this from
// cdn.jsdelivr.net is blocked by CSP and the map renders blank — react-simple-maps
// only logs the fetch error, so the only visible symptom is an empty box. Widening
// connect-src to admit a CDN would give back the exfiltration path that policy
// exists to close, for a file that never changes. The copy in public/ is
// world-atlas@2's countries-50m.json, byte for byte.
const GEO_URL = "/world-countries-50m.json";

// ISO 3166-1 numeric codes for European countries
const EUROPE_IDS = new Set([
  8, 20, 40, 56, 70, 100, 112, 191, 196, 203, 208, 233, 246, 250, 276, 300, 336,
  348, 352, 372, 380, 383, 428, 438, 440, 442, 470, 492, 498, 499, 528, 578,
  616, 620, 642, 643, 674, 688, 703, 705, 724, 752, 756, 792, 804, 807, 826,
]);

interface PartnerInfo {
  name: string;
  displayCountry: string;
  website: string | null;
}

interface MapProps {
  partnerOrganizations?: StrapiPartnerOrganization[];
  defaultCountry?: string | null;
}

export default function Map({
  partnerOrganizations = [],
  defaultCountry,
}: MapProps) {
  const [selected, setSelected] = useState<PartnerInfo | null>(() => {
    const first = partnerOrganizations[0];
    return first
      ? {
          name: first.name ?? "",
          displayCountry: first.displayCountry ?? "",
          website: first.website ?? null,
        }
      : null;
  });
  const [selectedCountry, setSelectedCountry] = useState<string | null>(
    () => partnerOrganizations[0]?.mapCountry ?? null,
  );

  const partners: Record<string, PartnerInfo> = {};
  partnerOrganizations.forEach((p) => {
    if (p.mapCountry)
      partners[p.mapCountry] = {
        name: p.name ?? "",
        displayCountry: p.displayCountry ?? "",
        website: p.website ?? null,
      };
  });

  const info = selected;

  return (
    <div className="flex flex-col-reverse gap-6 sm:flex-row sm:items-center">
      <div className="flex w-full shrink-0 flex-col items-center gap-1.5 text-center sm:w-32 sm:items-start sm:text-left">
        {info && (
          <>
            <p className="text-base font-medium text-slate-500">
              {info.displayCountry}
            </p>
            <p className="text-2xl font-bold whitespace-nowrap text-primary-700">
              {info.name}
            </p>
            {info.website && (
              <Anchor
                href={info.website}
                newTab
                className="mt-1 inline-flex items-center gap-1 text-sm font-normal whitespace-nowrap text-slate-500 hover:opacity-70"
              >
                {new URL(info.website).hostname}
              </Anchor>
            )}
          </>
        )}
      </div>

      <div className="relative flex-1">
        <ComposableMap
          projection="geoAzimuthalEqualArea"
          projectionConfig={{ rotate: [-6, -54, -2], scale: 1270 }}
          className="w-full"
          height={800}
        >
          <Geographies geography={GEO_URL}>
            {({ geographies, borders }) => (
              <>
                {geographies
                  .filter(
                    (geo) =>
                      EUROPE_IDS.has(Number(geo.id)) ||
                      geo.properties?.name === "Kosovo",
                  )
                  .map((geo) => {
                    const countryName = geo.properties?.name;
                    const isDefault = countryName === defaultCountry;
                    const isPartner = !isDefault && countryName in partners;
                    const partner = isPartner ? partners[countryName] : null;
                    const isSelected = countryName === selectedCountry;
                    const fill = isDefault
                      ? "fill-[#475569]"
                      : isSelected
                        ? "fill-[#065f46]"
                        : isPartner
                          ? "fill-[#047857]"
                          : "fill-[#e2e8f0]";

                    return (
                      <Geography
                        key={geo.rsmKey}
                        geography={geo}
                        onClick={() => {
                          if (partner) {
                            setSelected(partner);
                            setSelectedCountry(countryName);
                          }
                        }}
                        // react-simple-maps 5 has no hover/pressed style
                        // states any more, so hover is plain CSS.
                        className={classes(
                          fill,
                          isPartner
                            ? "cursor-pointer hover:fill-[#065f46] active:fill-[#065f46]"
                            : "",
                          "stroke-none outline-none",
                        )}
                      />
                    );
                  })}

                {/* Internal borders only — no outer coast lines */}
                {borders?.svgPath && (
                  <path
                    d={borders.svgPath}
                    fill="none"
                    stroke="#fff"
                    strokeWidth={0.7}
                    style={{ pointerEvents: "none" }}
                  />
                )}
              </>
            )}
          </Geographies>
        </ComposableMap>
      </div>
    </div>
  );
}
