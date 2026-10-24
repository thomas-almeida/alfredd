"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";

// Espelha SnapshotPoint de @/lib/youtube/snapshots (server-only, por isso não é importado).
type Point = {
  created_at: string;
  er: number | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  subscribers: number | null;
};
type ErPoint = { t: number; er: number; views: number | null; date: Date };

const HEIGHT = 220;
const PAD = { top: 16, right: 56, bottom: 28, left: 40 };
// Faixas de tier (em %), as mesmas de engagement.ts.
const THRESHOLDS = [
  { value: 2, label: "médio" },
  { value: 5, label: "alto" },
];

const fmtEr = (v: number) => `${v.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
const fmtDay = (d: Date) => d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
const fmtFull = (d: Date) =>
  d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

/** Escala "bonita" para o eixo Y: 0 até um teto arredondado, com ~4 marcas. */
function niceTicks(max: number): number[] {
  const raw = max / 4;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const top = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = 0; v <= top + step / 2; v += step) ticks.push(Number(v.toFixed(6)));
  return ticks;
}

export function ErHistoryChart({ kind, id }: { kind: "video" | "channel"; id: string }) {
  const [points, setPoints] = useState<ErPoint[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState<number | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    setPoints(null);
    setError(null);
    fetch(`/api/youtube/engagement/history?kind=${kind}&id=${encodeURIComponent(id)}`)
      .then(async (res) => {
        const json = (await res.json().catch(() => ({}))) as { points?: Point[]; error?: string };
        if (!alive) return;
        if (!res.ok || !json.points) {
          setError(json.error ?? "Não foi possível carregar o histórico.");
          return;
        }
        setPoints(
          json.points
            .filter((p): p is Point & { er: number } => p.er !== null && Number.isFinite(p.er))
            .map((p) => {
              const date = new Date(p.created_at);
              return { t: date.getTime(), er: p.er, views: p.views, date };
            }),
        );
      })
      .catch(() => alive && setError("Falha de rede ao carregar o histórico."));
    return () => {
      alive = false;
    };
  }, [kind, id]);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => entry && setWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, [points]);

  const title = (
    <h3 className="text-[14px] font-semibold text-fg">
      Taxa de engajamento ao longo do tempo{" "}
      <span className="font-normal text-subtle">· últimos 90 dias</span>
    </h3>
  );

  if (error) {
    return (
      <div>
        {title}
        <p className="mt-3 text-[13px] text-danger">{error}</p>
      </div>
    );
  }
  if (!points) {
    return (
      <div>
        {title}
        <p className="mt-3 text-[13px] text-subtle">Carregando histórico…</p>
      </div>
    );
  }
  if (points.length < 2) {
    return (
      <div>
        {title}
        <div className="mt-3 rounded-md border border-dashed border-border px-4 py-6 text-center">
          <p className="text-[13px] text-muted">Ainda não há pontos suficientes para desenhar a curva.</p>
          <p className="mt-1 text-[12px] text-subtle">
            Cada consulta grava um ponto (no máximo um por hora). Volte a consultar mais tarde para ver a
            evolução.
          </p>
        </div>
      </div>
    );
  }

  const innerW = Math.max(width - PAD.left - PAD.right, 10);
  const innerH = HEIGHT - PAD.top - PAD.bottom;
  const t0 = points[0]!.t;
  const t1 = points[points.length - 1]!.t;
  const ticks = niceTicks(Math.max(...points.map((p) => p.er), 0.1) * 1.1);
  const yMax = ticks[ticks.length - 1]!;
  const x = (t: number) => PAD.left + (t1 === t0 ? innerW / 2 : ((t - t0) / (t1 - t0)) * innerW);
  const y = (v: number) => PAD.top + innerH - (v / yMax) * innerH;

  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(p.t).toFixed(1)},${y(p.er).toFixed(1)}`).join("");
  const last = points[points.length - 1]!;
  const active = hover === null ? null : points[hover];

  function onMove(e: PointerEvent<SVGRectElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left + PAD.left;
    let best = 0;
    let dist = Infinity;
    points!.forEach((p, i) => {
      const d = Math.abs(x(p.t) - px);
      if (d < dist) {
        dist = d;
        best = i;
      }
    });
    setHover(best);
  }

  return (
    <div>
      {title}
      <div ref={boxRef} className="relative mt-3 w-full">
        {width > 0 && (
          <svg
            width={width}
            height={HEIGHT}
            role="img"
            aria-label={`Taxa de engajamento: ${points.length} pontos, último ${fmtEr(last.er)}`}
            className="block"
          >
            {/* Grade e eixo Y */}
            <g className="text-subtle">
              {ticks.map((v) => (
                <g key={v}>
                  <line
                    x1={PAD.left}
                    x2={PAD.left + innerW}
                    y1={y(v)}
                    y2={y(v)}
                    stroke="currentColor"
                    strokeOpacity={v === 0 ? 0.5 : 0.18}
                  />
                  <text x={PAD.left - 8} y={y(v)} dy="0.32em" textAnchor="end" fontSize={11} fill="currentColor">
                    {v.toLocaleString("pt-BR")}%
                  </text>
                </g>
              ))}
              {/* Limiares de tier, só quando cabem no domínio */}
              {THRESHOLDS.filter((th) => th.value < yMax).map((th) => (
                <g key={th.value}>
                  <line
                    x1={PAD.left}
                    x2={PAD.left + innerW}
                    y1={y(th.value)}
                    y2={y(th.value)}
                    stroke="currentColor"
                    strokeOpacity={0.45}
                    strokeDasharray="3 4"
                  />
                  <text x={PAD.left + 4} y={y(th.value) - 4} fontSize={10} fill="currentColor">
                    {th.label}
                  </text>
                </g>
              ))}
              <text x={PAD.left} y={HEIGHT - 8} fontSize={11} fill="currentColor">
                {fmtDay(points[0]!.date)}
              </text>
              <text x={PAD.left + innerW} y={HEIGHT - 8} textAnchor="end" fontSize={11} fill="currentColor">
                {fmtDay(last.date)}
              </text>
            </g>

            {/* Série */}
            <g className="text-accent">
              <path d={path} fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
              <circle cx={x(last.t)} cy={y(last.er)} r={4} fill="currentColor" stroke="var(--color-surface)" strokeWidth={2} />
            </g>
            {/* Rótulo direto só no último valor */}
            <text
              x={x(last.t) + 8}
              y={y(last.er)}
              dy="0.32em"
              fontSize={12}
              fontWeight={600}
              className="fill-fg"
            >
              {fmtEr(last.er)}
            </text>

            {/* Crosshair */}
            {active && (
              <g pointerEvents="none">
                <line
                  x1={x(active.t)}
                  x2={x(active.t)}
                  y1={PAD.top}
                  y2={PAD.top + innerH}
                  className="text-border-strong"
                  stroke="currentColor"
                />
                <circle
                  cx={x(active.t)}
                  cy={y(active.er)}
                  r={5}
                  className="text-accent"
                  fill="currentColor"
                  stroke="var(--color-surface)"
                  strokeWidth={2}
                />
              </g>
            )}

            {/* Área de captura maior que as marcas */}
            <rect
              x={PAD.left}
              y={0}
              width={innerW}
              height={HEIGHT}
              fill="transparent"
              onPointerMove={onMove}
              onPointerLeave={() => setHover(null)}
            />
          </svg>
        )}

        {active && (
          <div
            className="pointer-events-none absolute top-0 z-10 rounded-md border border-border bg-surface-2 px-3 py-2 text-[12px] shadow-sm"
            style={{
              left: Math.min(Math.max(x(active.t) - 80, 0), Math.max(width - 160, 0)),
              width: 160,
            }}
          >
            <div className="text-subtle">{fmtFull(active.date)}</div>
            <div className="mt-1 text-fg">
              ER <span className="font-semibold">{fmtEr(active.er)}</span>
            </div>
            {active.views !== null && (
              <div className="text-muted">{active.views.toLocaleString("pt-BR")} views</div>
            )}
          </div>
        )}
      </div>

      <details className="mt-3 text-[12px]">
        <summary className="cursor-pointer text-muted hover:text-fg">Ver dados em tabela</summary>
        <div className="mt-2 max-h-64 overflow-auto">
          <table className="w-full text-left">
            <thead className="text-subtle">
              <tr>
                <th className="py-1 pr-4 font-normal">Data</th>
                <th className="py-1 pr-4 font-normal text-right">ER</th>
                <th className="py-1 font-normal text-right">Views</th>
              </tr>
            </thead>
            <tbody className="text-fg">
              {points.map((p) => (
                <tr key={p.t} className="border-t border-border">
                  <td className="py-1 pr-4">{fmtFull(p.date)}</td>
                  <td className="py-1 pr-4 text-right tabular-nums">{fmtEr(p.er)}</td>
                  <td className="py-1 text-right tabular-nums">
                    {p.views === null ? "—" : p.views.toLocaleString("pt-BR")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
