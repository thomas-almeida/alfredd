"use client";

import { useState, useTransition } from "react";
import { grantLeadAccess } from "./actions";

export function LeadAccessButton({ leadId, granted }: { leadId: string; granted: boolean }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  if (granted) return <span className="rounded-full bg-accent/15 px-2.5 py-1 text-xs font-semibold text-accent">Concedido</span>;

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        disabled={pending}
        className="rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-accent-fg transition hover:brightness-110 disabled:opacity-50"
        onClick={() => startTransition(async () => {
          setError(null);
          const result = await grantLeadAccess(leadId);
          if (!result.ok) setError(result.error ?? "Falha ao conceder acesso.");
        })}
      >
        {pending ? "Concedendo…" : "Conceder acesso"}
      </button>
      {error && <span className="text-xs text-danger">{error}</span>}
    </div>
  );
}
