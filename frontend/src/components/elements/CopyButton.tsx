"use client";

import { useState } from "react";
import Modal from "../Modal";
import Button from "./Button";

interface CopyButtonProps {
  textToCopy: string;
  copiedText?: string;
  closeText?: string;
  [key: string]: unknown;
}

export default function CopyButton({
  textToCopy,
  copiedText = "Copied to clipboard!",
  closeText = "Close",
  ...rest
}: CopyButtonProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [modalData, setModalData] = useState({});

  function showModal(data: Record<string, unknown>) {
    setModalData(data);
    setModalOpen(true);
  }

  return (
    <>
      <Button
        onClick={() => {
          navigator.clipboard.writeText(textToCopy);
          showModal({
            icon: "success",
            title: copiedText,
            description: textToCopy,
          });
        }}
        {...rest}
      />
      <Modal
        open={modalOpen}
        data={modalData}
        setOpen={setModalOpen}
        closeText={closeText}
      />
    </>
  );
}
