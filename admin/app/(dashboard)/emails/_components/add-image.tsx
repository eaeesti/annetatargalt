"use client";

import { useEffect, useRef, useState } from "react";
import { ImagePlus } from "lucide-react";
import { Button } from "../../../../components/ui/button";
import { Input } from "../../../../components/ui/input";
import {
  CONNECTION_FAILED,
  failureMessage,
} from "../../../../lib/failure-message";
import { readJson } from "../../../../lib/read-json";
import { formatBytes } from "../../../../lib/pdf-upload";
import { LANGUAGES, type Localized } from "./types";

/** The pictures the backend takes; it checks the file's bytes itself. */
const TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const MAX_BYTES = 4 * 1024 * 1024;

/**
 * A picture in Markdown. Its description has its backslashes and brackets
 * escaped: one at the end would escape the bracket that closes it.
 */
function pictureMarkdown(description: string, url: string): string {
  return `![${description.trim().replace(/[\\[\]]/g, "\\$&")}](${url})`;
}

/**
 * Adds a picture to a block: chosen from the computer, described in both
 * languages, uploaded to the media library, and put at the end of the
 * block's text in each language.
 */
export function AddImage({ onAdd }: { onAdd: (markdown: Localized) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [description, setDescription] = useState<Localized>({
    et: "",
    en: "",
  });
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A preview of the chosen file, let go of once it's replaced or gone.
  const [preview, setPreview] = useState<string | null>(null);
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );

  function reset() {
    setFile(null);
    setPreview(null);
    setDescription({ et: "", en: "" });
    setError(null);
    if (input.current) input.current.value = "";
  }

  function choose(chosen: File | undefined) {
    setError(null);
    if (!chosen) return;
    if (!TYPES.includes(chosen.type)) {
      setError("Only JPEG, PNG, GIF and WebP pictures can be added.");
      return;
    }
    if (chosen.size > MAX_BYTES) {
      setError("The picture is larger than 4 MB.");
      return;
    }
    setFile(chosen);
    setPreview(URL.createObjectURL(chosen));
  }

  async function upload() {
    if (!file || !description.et.trim()) return;
    setUploading(true);
    setError(null);
    const form = new FormData();
    form.append("files", file);
    form.append("description", description.et);
    try {
      const res = await fetch("/api/emails/images", {
        method: "POST",
        body: form,
      });
      if (!res.ok) {
        setError(
          res.status === 413
            ? "The picture is larger than 4 MB."
            : await failureMessage(res, "Couldn't add the picture."),
        );
        return;
      }
      const { data } = await readJson<{ data: { url: string } }>(res);
      onAdd({
        et: pictureMarkdown(description.et, data.url),
        en: pictureMarkdown(description.en || description.et, data.url),
      });
      reset();
    } catch {
      setError(CONNECTION_FAILED);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-2">
      <input
        ref={input}
        type="file"
        accept={TYPES.join(",")}
        className="hidden"
        onChange={(event) => choose(event.target.files?.[0])}
      />
      {!file && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => input.current?.click()}
        >
          <ImagePlus /> Add a picture
        </Button>
      )}
      {file && (
        <div className="flex flex-wrap items-start gap-3 rounded-md border bg-muted/30 p-3">
          {preview && (
            // A local preview of the chosen file, not a page image.
            // oxlint-disable-next-line next/no-img-element
            <img
              src={preview}
              alt=""
              className="h-20 w-28 rounded object-cover"
            />
          )}
          <div className="min-w-0 flex-1 space-y-2">
            <p className="truncate text-xs text-muted-foreground">
              {file.name}, {formatBytes(file.size)}
            </p>
            {LANGUAGES.map(({ locale, label }) => (
              <label key={locale} className="flex flex-col gap-1 text-xs">
                <span className="text-muted-foreground">
                  What it shows, in {label}
                  {locale === "en" ? " (the Estonian if left empty)" : ""}
                </span>
                <Input
                  value={description[locale]}
                  maxLength={300}
                  onChange={(event) =>
                    setDescription({
                      ...description,
                      [locale]: event.target.value,
                    })
                  }
                  className="h-8"
                />
              </label>
            ))}
            <div className="flex gap-2">
              <Button
                size="sm"
                disabled={!description.et.trim() || uploading}
                onClick={upload}
              >
                {uploading ? "Adding…" : "Add it"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={uploading}
                onClick={reset}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
