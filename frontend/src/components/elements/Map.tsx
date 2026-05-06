"use client";

import { useState, useEffect } from "react";
import { ComposableMap, Geographies, Geography } from "react-simple-maps";
import { mesh } from "topojson-client";
import type { Topology, Objects } from "topojson-specification";
import type { StrapiPartnerOrganization } from "@/types/generated/strapi";
import Anchor from "./Anchor";

const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json";

// ISO 3166-1 numeric codes for European countries
const EUROPE_IDS = new Set([
  8, 20, 40, 56, 70, 100, 112, 191, 196, 203, 208, 233, 246, 250, 276, 300,
  336, 348, 352, 372, 380, 383, 428, 438, 440, 442, 470, 492, 498, 499, 528, 578,
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

export default function Map({ partnerOrganizations = [], defaultCountry }: MapProps) {
  const [selected, setSelected] = useState<PartnerInfo | null>(() => {
    const first = partnerOrganizations[0];
    return first ? { name: first.name ?? "", displayCountry: first.displayCountry ?? "", website: first.website ?? null } : null;
  });
  const [selectedCountry, setSelectedCountry] = useState<string | null>(() =>
    partnerOrganizations[0]?.mapCountry ?? null
  );
  const [topoData, setTopoData] = useState<Topology<Objects> | null>(null);

  const partners: Record<string, PartnerInfo> = {};
  partnerOrganizations.forEach((p) => {
    if (p.mapCountry) partners[p.mapCountry] = { name: p.name ?? "", displayCountry: p.displayCountry ?? "", website: p.website ?? null };
  });

  useEffect(() => {
    fetch(GEO_URL)
      .then((r) => r.json())
      .then(setTopoData);
  }, []);

  const info = selected;

  return (
    <div className="relative flex flex-col-reverse gap-6 sm:flex-row sm:items-center">
      <div className="w-full shrink-0 flex flex-col items-center sm:items-start gap-1.5 text-center sm:text-left sm:w-32">
        {info && (
          <>
            <p className="text-base font-medium text-slate-500">{info.displayCountry}</p>
            <p className="text-2xl font-bold whitespace-nowrap text-primary-700">{info.name}</p>
            {info.website && (
              <Anchor
                href={info.website}
                newTab
                className="mt-1 inline-flex items-center gap-1 font-normal whitespace-nowrap text-sm text-slate-500 hover:opacity-70"
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
            {({ geographies, path }) => (
              <>
                {geographies
                  .filter((geo) => EUROPE_IDS.has(Number(geo.id)) || geo.properties?.name === "Kosovo")
                  .map((geo) => {
                    const countryName = geo.properties?.name;
                    const isDefault = countryName === defaultCountry;
                    const isPartner = !isDefault && countryName in partners;
                    const partner = isPartner ? partners[countryName] : null;
                    const isSelected = countryName === selectedCountry;
                    const fill = isDefault ? "#475569" : isSelected ? "#065f46" : isPartner ? "#047857" : "#e2e8f0";
                    const fillHover = isDefault ? "#475569" : isPartner ? "#065f46" : "#e2e8f0";

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
                        cursor={isPartner && !isDefault ? "pointer" : "default"}
                        style={{
                          default: { fill, stroke: "none", outline: "none" },
                          hover: { fill: fillHover, stroke: "none", outline: "none" },
                          pressed: { fill: fillHover, stroke: "none", outline: "none" },
                        }}
                      />
                    );
                  })}

                {/* Internal borders only — no outer coast lines */}
                {topoData && (
                  <path
                    d={path(mesh(topoData, (topoData.objects as any).countries, (a: any, b: any) => a !== b)) ?? ""}
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
