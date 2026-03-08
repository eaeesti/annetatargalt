"use client";

import { useState } from "react";
import Modal from "../Modal";
import type { ModalData } from "../Modal";
import Button from "./Button";

interface CopyButtonProps {
  textToCopy: string;
  copiedText?: string | null;
  closeText?: string | null;
  size?: "link" | "sm" | "md" | "lg" | "xl" | "text" | null;
  type?: "primary" | "secondary" | "white" | "text" | null;
  className?: string;
  children?: React.ReactNode;
}

export default function CopyButton({
  textToCopy,
  copiedText = "Copied to clipboard!",
  closeText = "Close",
  size,
  type,
  className,
  children,
}: CopyButtonProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [modalData, setModalData] = useState<ModalData>({});

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(textToCopy);
      setModalData({ icon: "success", title: copiedText ?? "", description: textToCopy });
    } catch {
      setModalData({ icon: "error", title: "Copy failed", description: textToCopy });
    }
    setModalOpen(true);
  }

  return (
    <>
      <Button
        onClick={handleCopy}
        size={size}
        type={type}
        className={className}
      >
        {children}
      </Button>
      <Modal
        open={modalOpen}
        data={modalData}
        setOpen={setModalOpen}
        closeText={closeText ?? "Close"}
      />
    </>
  );
}
