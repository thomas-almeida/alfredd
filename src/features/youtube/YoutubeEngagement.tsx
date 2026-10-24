"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { MetricTile } from "@/components/ui/MetricTile";
import { cn } from "@/lib/cn";
// Só tipos: o módulo de engajamento roda no servidor (usa a chave da API).
import type { ChannelEngagement, GroupStats, Tier, VideoEngagement } from "@/lib/youtube/engagement";
import { FavoriteButton } from "@/features/favorites/FavoriteButton";
import { ErHistoryChart } from "./ErHistoryChart";
import { SaveYoutubeClipButton } from "./SaveYoutubeClipButton";

type Mode = "video" | "channel";

const inputCls =
  "h-[38px] px-3 rounded-sm bg-surface-2 border border-border text-[13px] text-fg placeholder:text-subtle focus:outline-none focus:border-border-strong";

const TIERS: Record<Tier, { tone: BadgeTone; label: string }> = {
  alto: { tone: "accent", label: "Alto" },
  medio: { tone: "warning", label: "Médio" },
  baixo: { tone: "danger", label: "Baixo" },
  indefinido: { tone: "neutral", label: "Indefinido" },
};

const FLAGS: Record<string, string> = {
  curtidas_ocultas: "Curtidas ocultas",
  comentarios_desativados: "Comentários desativados",
  video_recente: "Vídeo recente (ER ainda instável)",
  ao_vivo_ou_agendado: "Ao vivo ou agendado",
  sem_views: "Sem visualizações",
  antigo_demais: "Antigo demais para a amostra",
  sem_dados: "Sem dados",
};

function reasonLabel(reason: string): string {
  return reason
    .split("+")
    .map((r) => {
      const recent = /^menos_de_(\d+)h$/.exec(r);
      if (recent) return `Publicado há menos de ${recent[1]}h`;
      return FLAGS[r] ?? r;
    })
    .join(" · ");
}

const fmtInt = (v: number | null) => (v === null ? "—" : v.toLocaleString("pt-BR"));
const fmtCompact = (v: number | null) =>
  v === null ? "—" : v.toLocaleString("pt-BR", { notation: "compact", maximumFractionDigits: 1 });
const fmtEr = (v: number | null) =>
  v === null ? "—" : `${v.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;

function fmtAge(hours: number): string {
  if (hours < 48) return `${Math.round(hours)}h`;
  const days = Math.round(hours / 24);
  if (days < 60) return `${days} dias`;
  const months = Math.round(days / 30);
  return months < 24 ? `${months} meses` : `${Math.round(days / 365)} anos`;
}

function fmtDuration(total: number | null): string {
  if (total === null) return "—";
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

function TierBadge({ tier }: { tier: Tier }) {
  const t = TIERS[tier];
  return <Badge tone={t.tone}>{t.label}</Badge>;
}

export function YoutubeEngagement({ initialChannel }: { initialChannel?: string }) {
  const [mode, setMode] = useState<Mode>(initialChannel ? "channel" : "video");
  const [url, setUrl] = useState(initialChannel ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [video, setVideo] = useState<VideoEngagement | null>(null);
  const [channel, setChannel] = useState<ChannelEngagement | null>(null);

  function switchMode(next: Mode) {
    if (next === mode) return;
    setMode(next);
    setError(null);
  }

  async function fetchEngagement(link: string, nextMode: Mode) {
    if (!link) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/youtube/engagement/${nextMode}?url=${encodeURIComponent(link)}`);
      const json = (await res.json().catch(() => ({}))) as { error?: string; reason?: string };
      if (!res.ok || json.error) {
        setError(
          json.reason === "quotaExceeded"
            ? "A cota diária da API do YouTube acabou. Tente novamente amanhã."
            : (json.error?.replace(/^YouTube API:\s*/, "") ?? "Não foi possível consultar o YouTube."),
        );
        return;
      }
      if (nextMode === "video") setVideo(json as VideoEngagement);
      else setChannel(json as ChannelEngagement);
    } catch {
      setError("Falha de rede ao consultar o YouTube.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (initialChannel) void fetchEngagement(initialChannel, "channel");
    // A URL-selected favorite is intentionally loaded once on entry.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialChannel]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    await fetchEngagement(url.trim(), mode);
  }

  const tabs: { id: Mode; label: string }[] = [
    { id: "video", label: "Vídeo" },
    { id: "channel", label: "Canal" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <div role="tablist" aria-label="Tipo de análise" className="mb-4 flex gap-1 border-b border-border">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={mode === t.id}
              onClick={() => switchMode(t.id)}
              className={cn(
                "-mb-px border-b-2 px-3 pb-2 text-[13px] font-medium transition-colors",
                mode === t.id ? "border-accent text-fg" : "border-transparent text-muted hover:text-fg",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        <form onSubmit={onSubmit} className="flex gap-3 max-[860px]:flex-col">
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder={
              mode === "video"
                ? "https://www.youtube.com/watch?v=... ou https://youtu.be/..."
                : "https://www.youtube.com/@canal, /channel/UC... ou @handle"
            }
            aria-label={mode === "video" ? "Link do vídeo" : "Link do canal"}
            className={cn(inputCls, "flex-1")}
            required
          />
          <Button type="submit" variant="primary" disabled={loading || !url.trim()}>
            {loading ? "Consultando…" : "Buscar"}
          </Button>
        </form>
        <p className="mt-3 text-[12px] text-subtle">
          {mode === "video"
            ? "ER = (curtidas + comentários) ÷ visualizações. Acima de 5% é alto; entre 2% e 5%, médio."
            : "Analisa os vídeos recentes do canal (até 50) e separa vídeos longos de Shorts."}
        </p>
        {error && (
          <p role="alert" className="mt-3 text-[13px] text-danger">
            {error}
          </p>
        )}
      </Card>

      {mode === "video" && video && <VideoPanel key={video.videoId} v={video} />}
      {mode === "channel" && channel && <ChannelPanel key={channel.channelId} c={channel} />}
    </div>
  );
}

/**
 * Imagens do YouTube carregadas direto da CDN. O yt3.ggpht.com (avatares) recusa
 * hotlink quando a requisição traz Referer de outro site (responde 429 com HTML),
 * por isso o `no-referrer`. Se ainda assim falhar, mostra a inicial no lugar.
 */
function Thumb({ src, className, fallback }: { src: string | null; className?: string; fallback?: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    if (!fallback) return null;
    return (
      <div
        aria-hidden
        className={cn(
          "grid place-items-center bg-surface-2 text-[22px] font-semibold text-muted shrink-0",
          className,
        )}
      >
        {fallback.charAt(0).toUpperCase()}
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      referrerPolicy="no-referrer"
      loading="lazy"
      onError={() => setFailed(true)}
      className={cn("bg-surface-2 object-cover shrink-0", className)}
    />
  );
}

function Hero({ label, er, tier, note }: { label: string; er: number | null; tier: Tier; note?: ReactNode }) {
  return (
    <div className="shrink-0 text-right max-[860px]:text-left">
      <div className="text-[12px] text-muted">{label}</div>
      <div className="mt-1 flex items-center justify-end gap-3 max-[860px]:justify-start">
        <span className="text-[34px] font-bold leading-none text-fg tabular-nums">{fmtEr(er)}</span>
        <TierBadge tier={tier} />
      </div>
      {note && <div className="mt-2 text-[12px] text-subtle">{note}</div>}
    </div>
  );
}

/** Faixa de métricas sob o cabeçalho, separada por uma divisória. */
function MetricStrip({ children }: { children: ReactNode }) {
  return (
    <div className="mt-6 border-t border-border grid grid-cols-4 max-[860px]:grid-cols-2">{children}</div>
  );
}

function VideoPanel({ v }: { v: VideoEngagement }) {
  return (
    <>
      <Card>
        <div className="flex justify-between items-start gap-6 max-[860px]:flex-col">
          <div className="flex gap-4 items-start min-w-0 max-[860px]:flex-col">
            <Thumb src={v.thumbnailUrl} className="w-48 aspect-video rounded-md" />
            <div className="min-w-0">
              <Badge tone="info">{v.isShortLikely ? "Short" : "Vídeo longo"}</Badge>
              <h2 className="mt-2 text-[15px] font-semibold text-fg break-words">
                <a href={v.url} target="_blank" rel="noreferrer" className="hover:underline">
                  {v.title}
                </a>
              </h2>
              <p className="mt-1 text-[13px] text-muted">
                {v.channelTitle} · {fmtDuration(v.durationSeconds)} · publicado há {fmtAge(v.ageHours)}
              </p>
            </div>
          </div>
          <Hero label="Taxa de engajamento" er={v.er} tier={v.tier} />
        </div>

        <MetricStrip>
          <MetricTile value={fmtCompact(v.views)} label="Visualizações" note={fmtInt(v.views)} />
          <MetricTile value={fmtCompact(v.likes)} label="Curtidas" note={`ER curtidas ${fmtEr(v.erLikes)}`} />
          <MetricTile
            value={fmtCompact(v.comments)}
            label="Comentários"
            note={`ER comentários ${fmtEr(v.erComments)}`}
          />
          <MetricTile
            value={v.viewsPerHour.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
            label="Views por hora"
            note="média desde a publicação"
          />
        </MetricStrip>

        <div className="mt-5 border-t border-border pt-4">
          <SaveYoutubeClipButton videoId={v.videoId} title={v.title} channelTitle={v.channelTitle} thumbnailUrl={v.thumbnailUrl} durationSeconds={v.durationSeconds} />
        </div>

        {v.flags.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {v.flags.map((f) => (
              <Badge key={f} tone="warning">
                {reasonLabel(f)}
              </Badge>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <ErHistoryChart kind="video" id={v.videoId} />
      </Card>
    </>
  );
}

const GROUPS: { key: "all" | "long" | "shorts"; label: string }[] = [
  { key: "all", label: "Todos" },
  { key: "long", label: "Vídeos longos" },
  { key: "shorts", label: "Shorts" },
];

function ChannelPanel({ c }: { c: ChannelEngagement }) {
  const hasSubs = c.all.erPerSubscriber !== null;
  return (
    <>
      <Card>
        <div className="flex justify-between items-start gap-6 max-[860px]:flex-col">
          <div className="flex gap-4 items-center min-w-0">
            <Thumb src={c.thumbnailUrl} fallback={c.title} className="size-16 rounded-full" />
            <div className="min-w-0">
              <h2 className="text-[17px] font-semibold text-fg break-words">{c.title}</h2>
              <p className="mt-0.5 text-[13px] text-muted">
                {c.handle && <>{c.handle} · </>}
                <a
                  href={`https://www.youtube.com/channel/${c.channelId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-fg hover:underline"
                >
                  Abrir no YouTube
                </a>
              </p>
              <div className="mt-2.5 flex">
                <FavoriteButton
                  kind="youtuber"
                  channelId={c.channelId}
                  title={c.title}
                  handle={c.handle}
                  thumbnailUrl={c.thumbnailUrl}
                />
              </div>
            </div>
          </div>
          <Hero
            label="ER ponderado do canal"
            er={c.all.erWeighted}
            tier={c.all.tier}
            note={`${c.sample.analyzed} de ${c.sample.requested} vídeos analisados`}
          />
        </div>

        <MetricStrip>
          <MetricTile value={fmtCompact(c.subscribers)} label="Inscritos" note={fmtInt(c.subscribers)} />
          <MetricTile value={fmtCompact(c.totalViews)} label="Visualizações totais" note={fmtInt(c.totalViews)} />
          <MetricTile value={fmtInt(c.totalVideos)} label="Vídeos publicados" />
          <MetricTile
            value={c.all.videos ? fmtCompact(c.all.avgViews) : "—"}
            label="Média de views"
            note={`últimos ${c.all.videos} vídeos`}
          />
        </MetricStrip>
      </Card>

      <Card>
        <CardHeader title="Por formato" />
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead className="text-[12px] text-subtle">
              <tr>
                <th className="py-2 pr-4 font-normal">Grupo</th>
                <th className="py-2 pr-4 font-normal text-right">Vídeos</th>
                <th className="py-2 pr-4 font-normal text-right">Média de views</th>
                <th className="py-2 pr-4 font-normal text-right">ER ponderado</th>
                <th className="py-2 pr-4 font-normal text-right">ER mediano</th>
                {hasSubs && <th className="py-2 pr-4 font-normal text-right">ER/inscrito</th>}
                <th className="py-2 font-normal">Faixa</th>
              </tr>
            </thead>
            <tbody className="text-fg">
              {GROUPS.map(({ key, label }) => (
                <GroupRow key={key} label={label} g={c[key]} hasSubs={hasSubs} />
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {(c.best || c.worst) && (
        <div className="grid grid-cols-2 gap-6 max-[860px]:grid-cols-1">
          {c.best && <HighlightCard title="Melhor engajamento" v={c.best} />}
          {c.worst && <HighlightCard title="Pior engajamento" v={c.worst} />}
        </div>
      )}

      <Card>
        <ErHistoryChart kind="channel" id={c.channelId} />
      </Card>

      {c.videos.length > 0 && (
        <Card>
          <CardHeader title={`Vídeos analisados (${c.videos.length})`} />
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead className="text-[12px] text-subtle">
                <tr>
                  <th className="py-2 pr-4 font-normal">Vídeo</th>
                  <th className="py-2 pr-4 font-normal text-right">Views</th>
                  <th className="py-2 pr-4 font-normal text-right">Curtidas</th>
                  <th className="py-2 pr-4 font-normal text-right">Comentários</th>
                  <th className="py-2 pr-4 font-normal text-right">ER</th>
                  <th className="py-2 font-normal">Faixa</th>
                </tr>
              </thead>
              <tbody className="text-fg">
                {c.videos.map((v) => (
                  <tr key={v.videoId} className="border-t border-border">
                    <td className="py-2 pr-4 max-w-[360px]">
                      <a href={v.url} target="_blank" rel="noreferrer" className="block truncate hover:underline">
                        {v.title}
                      </a>
                      <span className="text-[12px] text-subtle">
                        {v.isShortLikely ? "Short" : "Longo"} · há {fmtAge(v.ageHours)}
                      </span>
                      <div className="mt-2">
                        <SaveYoutubeClipButton videoId={v.videoId} title={v.title} channelTitle={c.title} thumbnailUrl={v.thumbnailUrl} durationSeconds={v.durationSeconds} />
                      </div>
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums">{fmtCompact(v.views)}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">{fmtCompact(v.likes)}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">{fmtCompact(v.comments)}</td>
                    <td className="py-2 pr-4 text-right tabular-nums font-semibold">{fmtEr(v.er)}</td>
                    <td className="py-2">
                      <TierBadge tier={v.tier} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {c.sample.skipped.length > 0 && (
        <Card>
          <CardHeader title={`Fora da amostra (${c.sample.skipped.length})`} />
          <ul className="flex flex-col gap-1.5 text-[13px]">
            {c.sample.skipped.map((s) => (
              <li key={s.videoId} className="flex gap-3">
                <a
                  href={`https://www.youtube.com/watch?v=${s.videoId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono text-[12px] text-muted hover:text-fg"
                >
                  {s.videoId}
                </a>
                <span className="text-fg">{reasonLabel(s.reason)}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <p className="text-[12px] text-subtle">
        Esta consulta usou {c.quotaUnits} unidade{c.quotaUnits === 1 ? "" : "s"} da cota diária da API do YouTube.
      </p>
    </>
  );
}

function GroupRow({ label, g, hasSubs }: { label: string; g: GroupStats; hasSubs: boolean }) {
  return (
    <tr className="border-t border-border">
      <td className="py-2 pr-4">{label}</td>
      <td className="py-2 pr-4 text-right tabular-nums">{g.videos}</td>
      <td className="py-2 pr-4 text-right tabular-nums">{g.videos ? fmtCompact(g.avgViews) : "—"}</td>
      <td className="py-2 pr-4 text-right tabular-nums font-semibold">{fmtEr(g.erWeighted)}</td>
      <td className="py-2 pr-4 text-right tabular-nums">{fmtEr(g.erMedian)}</td>
      {hasSubs && <td className="py-2 pr-4 text-right tabular-nums">{fmtEr(g.erPerSubscriber)}</td>}
      <td className="py-2">{g.videos ? <TierBadge tier={g.tier} /> : <span className="text-subtle">—</span>}</td>
    </tr>
  );
}

function HighlightCard({ title, v }: { title: string; v: VideoEngagement }) {
  return (
    <Card>
      <CardHeader title={title} />
      <div className="flex gap-3 items-start">
        <Thumb src={v.thumbnailUrl} className="w-32 aspect-video rounded-md" />
        <div className="min-w-0">
          <a
            href={v.url}
            target="_blank"
            rel="noreferrer"
            className="line-clamp-2 text-[13px] font-medium text-fg hover:underline"
          >
            {v.title}
          </a>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-[15px] font-bold text-fg tabular-nums">{fmtEr(v.er)}</span>
            <TierBadge tier={v.tier} />
          </div>
          <p className="mt-1 text-[12px] text-subtle">
            {fmtCompact(v.views)} views · há {fmtAge(v.ageHours)}
          </p>
        </div>
      </div>
    </Card>
  );
}
