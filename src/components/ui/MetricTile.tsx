import type { ReactNode } from "react";

/** Bloco de métrica (valor grande + rótulo + nota). */
export function MetricTile({
  value,
  label,
  note,
}: {
  value: ReactNode;
  label: string;
  note?: ReactNode;
}) {
  return (
    <div className="py-4 pr-6">
      <div className="text-2xl font-bold tracking-tight">{value}</div>
      <div className="text-muted text-[13px] mt-1">{label}</div>
      {note && <div className="mt-2 text-xs text-subtle">{note}</div>}
    </div>
  );
}
