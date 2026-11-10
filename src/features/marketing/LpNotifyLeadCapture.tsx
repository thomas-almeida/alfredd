"use client";

import { useState } from "react";
import Notify, { type NotifyMessage } from "@/components/ui/Notify";
import { LeadCaptureModal } from "./LeadCaptureModal";

export function LpNotifyLeadCapture({ messages = [] }: { messages?: readonly NotifyMessage[] }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Notify messages={messages} onOpen={() => setOpen(true)} />
      <LeadCaptureModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
