"use client";

import { useState } from "react";
import Modal from "../Modal";
import Button from "./Button";

export default function CopyButton({
  textToCopy,
  copiedText = "Copied to clipboard!",
  closeText = "Close",
  ...rest
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [modalData, setModalData] = useState({});

  function showModal(data) {
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
