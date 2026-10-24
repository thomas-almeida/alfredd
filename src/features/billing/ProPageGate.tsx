"use client";

import { useState } from "react";
import { UpgradeModal } from "./UpgradeModal";

export function ProPageGate({ title, description, open: initialOpen = true }: { title: string; description: string; open?: boolean }) {
  const [open, setOpen] = useState(initialOpen);
  return <UpgradeModal open={open} onClose={() => setOpen(false)} title={title} description={description} />;
}
