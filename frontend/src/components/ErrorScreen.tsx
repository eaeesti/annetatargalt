"use client";

/**
 * Shown when a page fails to render — most often because the frontend can't
 * talk to Strapi (bad API token after a prod-DB restore, backend not running).
 * The message thrown from utils/strapi.ts is already actionable, so surface it.
 */
export default function ErrorScreen({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset?: () => void;
}) {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col justify-center gap-4 p-6">
      <h1 className="text-xl font-semibold">This page couldn&apos;t load</h1>
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-600">
        {error?.message || "An unexpected error occurred."}
      </p>
      {reset && (
        <button
          onClick={reset}
          className="self-start rounded-md border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-100"
        >
          Try again
        </button>
      )}
    </div>
  );
}
