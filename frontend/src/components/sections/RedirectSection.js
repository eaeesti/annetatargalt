"use client";

import { useRouter } from "next/navigation";
import LoadingSection from "./LoadingSection";
import { useEffect } from "react";

export default function RedirectSection({ destination }) {
  const router = useRouter();

  useEffect(() => {
    router.replace(destination);
  }, []);

  return <LoadingSection />;
}
