"use client";

import { useState } from "react";
import { LeadCaptureModal } from "./LeadCaptureModal";

export function LandingPageCta({ label = "Garantir acesso" }: { label?: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="lp-button w-full flex justify-center text-center sm:w-auto">
        {label}
      </button>
      <LeadCaptureModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
