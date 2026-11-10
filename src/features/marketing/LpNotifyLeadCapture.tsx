"use client";

import { useState } from "react";
import Notify from "@/components/ui/Notify";
import { LeadCaptureModal } from "./LeadCaptureModal";

export function LpNotifyLeadCapture({ message }: { message: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Notify message={message} onOpen={() => setOpen(true)} />
      <LeadCaptureModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
