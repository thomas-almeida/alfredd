"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { UpgradeModal } from "./UpgradeModal";

export function ProActionButton({ label = "Monitorar (PRO)" }: { label?: string }) {
  const [open, setOpen] = useState(false);
  return <>
    <Button variant="primary" onClick={() => setOpen(true)}>{label}</Button>
    <UpgradeModal
      open={open}
      onClose={() => setOpen(false)}
      title="Recurso exclusivo do PRO"
      description="Esse recurso está disponível apenas para usuários PRO. Assine para desbloquear monitoramentos, alertas e limites maiores."
    />
  </>;
}
