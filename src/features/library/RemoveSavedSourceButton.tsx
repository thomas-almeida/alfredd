"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { UpgradeModal } from "@/features/billing/UpgradeModal";
import { removeSavedVod, removeSavedYoutube } from "./actions";

export function RemoveSavedSourceButton({ kind, id, isPro }: { kind: "youtube" | "vod"; id: string; isPro: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  function remove() {
    if (!isPro) {
      setUpgradeOpen(true);
      return;
    }
    start(async () => {
      const result = kind === "youtube" ? await removeSavedYoutube(id) : await removeSavedVod(id);
      if (result.ok) router.refresh();
    });
  }

  return <>
    <Button variant="ghost" size="sm" onClick={remove} disabled={pending}>
      {pending ? "Removendo…" : "Remover"}
    </Button>
    <UpgradeModal open={upgradeOpen} onClose={() => setUpgradeOpen(false)} title="Recurso exclusivo do PRO" description="Remover vídeos e VODs da biblioteca é um recurso premium. Assine o PRO para gerenciar sua biblioteca sem essa limitação." />
  </>;
}
