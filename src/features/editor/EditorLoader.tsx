"use client";

export type LoaderStep = { label: string; state: "done" | "active" | "todo" };

const mb = (n: number) => (n / 1024 / 1024).toFixed(1);

/**
 * Loader do editor: etapas com status + barra de progresso. `progress` em
 * [0,1] mostra barra determinada; `null` mostra barra indeterminada.
 */
export function EditorLoader({
  title,
  steps,
  progress,
  loaded,
  total,
  thumbnailUrl,
}: {
  title: string;
  steps: LoaderStep[];
  progress: number | null;
  loaded?: number;
  total?: number;
  thumbnailUrl?: string | null;
}) {
  const pct = progress === null ? null : Math.round(progress * 100);
  return (
    <div className="w-full max-w-[560px] mx-auto mt-6 bg-surface border border-border rounded-lg overflow-hidden">
      <div
        className="relative aspect-video bg-surface-2 bg-cover bg-center"
        style={thumbnailUrl ? { backgroundImage: `url(${thumbnailUrl})` } : undefined}
      >
        <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-3">
          <div className="w-10 h-10 rounded-full border-[3px] border-white/20 border-t-accent animate-spin" />
          <p className="text-[#e7e7ea] text-sm font-medium">{title}</p>
          {pct !== null && (
            <p className="text-accent text-2xl font-semibold tabular-nums">{pct}%</p>
          )}
        </div>
      </div>

      <div className="p-4 flex flex-col gap-4">
        <div>
          <div className="h-2 rounded-full bg-surface-2 overflow-hidden">
            {pct === null ? (
              <div className="loader-indeterminate h-full w-2/5 rounded-full bg-accent" />
            ) : (
              <div
                className="h-full rounded-full bg-accent transition-[width] duration-200"
                style={{ width: `${pct}%` }}
              />
            )}
          </div>
          {loaded !== undefined && (
            <p className="text-xs text-muted mt-1.5 tabular-nums">
              {mb(loaded)} MB{total ? ` de ${mb(total)} MB` : ""}
            </p>
          )}
        </div>

        <ol className="flex flex-col gap-2">
          {steps.map((s) => (
            <li key={s.label} className="flex items-center gap-2.5 text-[13px]">
              <span
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold ${
                  s.state === "done"
                    ? "bg-accent text-accent-fg"
                    : s.state === "active"
                      ? "border-2 border-accent border-t-transparent animate-spin"
                      : "border border-border-strong"
                }`}
              >
                {s.state === "done" ? "✓" : ""}
              </span>
              <span className={s.state === "todo" ? "text-subtle" : s.state === "active" ? "text-fg" : "text-muted"}>
                {s.label}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
