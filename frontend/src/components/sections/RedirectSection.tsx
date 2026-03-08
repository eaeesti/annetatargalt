"use client";

import { useRouter } from "next/navigation";
import LoadingSection from "./LoadingSection";
import { useEffect } from "react";
import type { StrapiRedirectSection } from "@/types/generated/strapi";

export default function RedirectSection({ destination }: StrapiRedirectSection) {
  const router = useRouter();

  useEffect(() => {
    if (destination) {
      router.replace(destination);
    }
  }, [destination, router]);

  return <LoadingSection />;
}
