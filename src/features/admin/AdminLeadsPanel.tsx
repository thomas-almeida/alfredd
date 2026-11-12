"use client";

/* Meta returns dynamic CDN URLs that are not known at build time. */
/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { LeadAccessButton } from "./LeadAccessButton";

export type AdminLead = {
  lead_id: string;
  name: string;
  email: string;
  whatsapp: string;
  fbp: string | null;
  fbc: string | null;
  fbclid: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  campaign_id: string | null;
  campaign_name: string | null;
  adset_id: string | null;
  adset_name: string | null;
  ad_id: string | null;
  ad_name: string | null;
  placement: string | null;
  site_source_name: string | null;
  created_at: string;
  access_granted: boolean;
};

type OriginType = "paid" | "organic";
type OriginChannel = "facebook" | "instagram" | null;
type Origin = { type: OriginType; channel: OriginChannel; label: string };

type MetaInsightsData = {
  configured: boolean;
  spend: number;
  impressions: number;
  lpClicks: number;
  clickSource: "landing_page_view" | "link_click" | "outbound_click" | null;
};

type MetaCreativeData = {
  adId: string;
  adName: string | null;
  creativeId: string | null;
  creativeName: string | null;
  imageUrl: string | null;
  thumbnailUrl: string | null;
};

function getOrigin(lead: AdminLead): Origin {
  const channelSources = [lead.site_source_name, lead.utm_source, lead.placement].filter(Boolean).join(" ").toLowerCase();
  const medium = lead.utm_medium?.toLowerCase() ?? "";
  const instagram = /instagram|(^|[^a-z])ig([^a-z]|$)/.test(channelSources);
  const facebook = /facebook|(^|[^a-z])fb([^a-z]|$)/.test(channelSources);
  const channel = instagram ? "instagram" : facebook ? "facebook" : null;
  const paid = Boolean(lead.fbclid || lead.fbc || lead.campaign_id || lead.adset_id || lead.ad_id || /paid|cpc|ppc|ads|display|social/.test(medium));
  if (!paid) return { type: "organic", channel: null, label: "Orgânico" };
  return { type: "paid", channel, label: channel === "facebook" ? "Facebook" : channel === "instagram" ? "Instagram" : "Meta Ads" };
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function dateInputValue(time: number) {
  const date = new Date(time);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function formatCurrency(value: number | null) {
  if (value === null) return "—";
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });
}

function formatNumber(value: number | null) {
  if (value === null) return "—";
  return value.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
}

function formatPercent(value: number | null) {
  if (value === null) return "—";
  return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
}

function csvValue(value: unknown) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function downloadCsv(leads: AdminLead[]) {
  const header = ["Data de entrada", "Origem", "Nome", "E-mail", "WhatsApp", "Lead ID", "UTM source", "UTM medium", "Campanha", "Conjunto de anúncios", "Anúncio", "Posicionamento", "fbclid"];
  const rows = leads.map((lead) => {
    const origin = getOrigin(lead);
    return [formatDate(lead.created_at), origin.label, lead.name, lead.email, lead.whatsapp, lead.lead_id, lead.utm_source, lead.utm_medium, lead.campaign_name ?? lead.campaign_id, lead.adset_name ?? lead.adset_id, lead.ad_name ?? lead.ad_id, lead.placement ?? lead.site_source_name, lead.fbclid].map(csvValue).join(",");
  });
  const blob = new Blob(["\uFEFF", [header.map(csvValue).join(","), ...rows].join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function MetricCard({ icon, label, value, detail, tone = "default" }: { icon: "users" | "target" | "leaf" | "calendar" | "card" | "link" | "eye" | "radar"; label: string; value: string; detail: string; tone?: "default" | "accent" }) {
  return (
    <div className={`relative flex min-h-25 items-center justify-between overflow-hidden rounded-2xl border p-5 ${tone === "accent" ? "border-accent/25 bg-[linear-gradient(135deg,rgba(180,243,74,.12),rgba(18,18,20,.92)_64%)]" : "border-border bg-surface"}`}>
      <div className="flex items-center justify-start gap-2">
        <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${tone === "accent" ? "bg-accent text-accent-fg" : "bg-surface-2 text-muted"}`}>
          <Icon name={icon} width={17} height={17} />
        </span>
        <div>
          <p className="text-[12px] font-medium uppercase tracking-[.12em] text-accent">{label}</p>
          <p className="text-xs text-subtle">{detail}</p>
        </div>
      </div>
      <p className="mt-1 text-right text-[2rem] font-semibold leading-none tracking-[-.04em] text-fg tabular-nums">{value}</p>
    </div>
  );
}

function CopyField({ label, value, copied, onCopy }: { label: string; value: string | null; copied: string | null; onCopy: (label: string, value: string) => void }) {
  if (!value) return null;
  return (
    <div className="group rounded-xl border border-border bg-surface-2/60 p-3">
      <div className="flex items-center justify-between gap-3">
        <dt className="text-[10px] font-semibold uppercase tracking-[.12em] text-subtle">{label}</dt>
        <button type="button" onClick={() => onCopy(label, value)} className="rounded-md p-1 text-subtle opacity-0 transition hover:bg-surface-hover hover:text-fg group-hover:opacity-100 focus:opacity-100" aria-label={`Copiar ${label}`}>
          {copied === label ? <span className="text-[10px] font-semibold text-accent">OK</span> : <Icon name="copy" width={14} height={14} />}
        </button>
      </div>
      <dd className="mt-1 break-all text-sm text-fg">{value}</dd>
    </div>
  );
}

export function AdminLeadsPanel({ leads }: { leads: AdminLead[] }) {
  const [query, setQuery] = useState("");
  const [originFilter, setOriginFilter] = useState<"all" | "facebook" | "instagram" | "organic">("all");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [selectedLead, setSelectedLead] = useState<AdminLead | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [metaInsights, setMetaInsights] = useState<MetaInsightsData | null>(null);
  const [metaInsightsLoading, setMetaInsightsLoading] = useState(false);
  const [metaInsightsError, setMetaInsightsError] = useState<string | null>(null);
  const [metaCreative, setMetaCreative] = useState<MetaCreativeData | null>(null);
  const [metaCreativeLoading, setMetaCreativeLoading] = useState(false);
  const [metaCreativeError, setMetaCreativeError] = useState<string | null>(null);

  const dateFilteredLeads = useMemo(() => {
    const fromTime = fromDate ? new Date(`${fromDate}T00:00:00`).getTime() : null;
    const toTime = toDate ? new Date(`${toDate}T23:59:59.999`).getTime() : null;
    return leads.filter((lead) => {
      const date = new Date(lead.created_at).getTime();
      return (fromTime === null || date >= fromTime) && (toTime === null || date <= toTime);
    });
  }, [fromDate, leads, toDate]);

  const stats = useMemo(() => {
    const paid = dateFilteredLeads.filter((lead) => getOrigin(lead).type === "paid").length;
    const organic = dateFilteredLeads.length - paid;
    if (!dateFilteredLeads.length) return { paid, organic, average: "0", daySpan: 0 };
    const dates = dateFilteredLeads.map((lead) => new Date(lead.created_at).getTime()).filter(Number.isFinite);
    const first = fromDate ? new Date(`${fromDate}T00:00:00`).getTime() : Math.min(...dates);
    const last = toDate ? new Date(`${toDate}T23:59:59.999`).getTime() : Math.max(...dates);
    const daySpan = Math.max(1, Math.floor((last - first) / 86_400_000) + 1);
    return { paid, organic, average: (dateFilteredLeads.length / daySpan).toLocaleString("pt-BR", { maximumFractionDigits: 1 }), daySpan };
  }, [dateFilteredLeads, fromDate, toDate]);

  const originCounts = useMemo(() => ({
    all: dateFilteredLeads.length,
    facebook: dateFilteredLeads.filter((lead) => getOrigin(lead).channel === "facebook").length,
    instagram: dateFilteredLeads.filter((lead) => getOrigin(lead).channel === "instagram").length,
    organic: dateFilteredLeads.filter((lead) => getOrigin(lead).type === "organic").length,
  }), [dateFilteredLeads]);

  const metaRange = useMemo(() => {
    const dates = leads.map((lead) => new Date(lead.created_at).getTime()).filter(Number.isFinite);
    if (!dates.length) return null;
    const since = fromDate || dateInputValue(Math.min(...dates));
    const until = toDate || dateInputValue(Math.max(...dates));
    return since <= until ? { since, until } : null;
  }, [fromDate, leads, toDate]);

  useEffect(() => {
    const controller = new AbortController();
    if (!metaRange) {
      setMetaInsights(null);
      setMetaInsightsError(null);
      setMetaInsightsLoading(false);
      return () => controller.abort();
    }

    setMetaInsightsLoading(true);
    setMetaInsightsError(null);
    const params = new URLSearchParams(metaRange);
    fetch(`/api/admin/meta-insights?${params.toString()}`, { signal: controller.signal })
      .then(async (response) => {
        const body = await response.json() as MetaInsightsData & { error?: string };
        if (!response.ok) throw new Error(body.error ?? "Não foi possível consultar a Meta.");
        return body;
      })
      .then((data) => setMetaInsights(data))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setMetaInsights(null);
        setMetaInsightsError(error instanceof Error ? error.message : "Não foi possível consultar a Meta.");
      })
      .finally(() => setMetaInsightsLoading(false));

    return () => controller.abort();
  }, [metaRange]);

  useEffect(() => {
    const adId = selectedLead?.ad_id;
    const controller = new AbortController();
    setMetaCreative(null);
    setMetaCreativeError(null);
    if (!adId || !/^\d+$/.test(adId)) {
      setMetaCreativeLoading(false);
      return () => controller.abort();
    }

    setMetaCreativeLoading(true);
    fetch(`/api/admin/meta-creative?adId=${encodeURIComponent(adId)}`, { signal: controller.signal })
      .then(async (response) => {
        const body = await response.json() as MetaCreativeData & { error?: string };
        if (!response.ok) throw new Error(body.error ?? "Não foi possível carregar o criativo.");
        return body;
      })
      .then((data) => setMetaCreative(data))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setMetaCreativeError(error instanceof Error ? error.message : "Não foi possível carregar o criativo.");
      })
      .finally(() => setMetaCreativeLoading(false));

    return () => controller.abort();
  }, [selectedLead?.ad_id]);

  const filteredLeads = useMemo(() => {
    const search = query.trim().toLowerCase();
    const fromTime = fromDate ? new Date(`${fromDate}T00:00:00`).getTime() : null;
    const toTime = toDate ? new Date(`${toDate}T23:59:59.999`).getTime() : null;
    return leads.filter((lead) => {
      const origin = getOrigin(lead);
      const date = new Date(lead.created_at).getTime();
      const searchable = [lead.name, lead.email, lead.whatsapp, lead.lead_id].join(" ").toLowerCase();
      return (!search || searchable.includes(search)) && (originFilter === "all" || (originFilter === "organic" ? origin.type === "organic" : origin.channel === originFilter)) && (fromTime === null || date >= fromTime) && (toTime === null || date <= toTime);
    }).sort((a, b) => {
      const difference = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      return sortOrder === "newest" ? -difference : difference;
    });
  }, [fromDate, leads, originFilter, query, sortOrder, toDate]);

  const metaSpend = metaInsights?.configured ? metaInsights.spend : null;
  const metaClicks = metaInsights?.configured ? metaInsights.lpClicks : null;
  const metaImpressions = metaInsights?.configured ? metaInsights.impressions : null;
  const cpc = metaSpend !== null && metaClicks ? metaSpend / metaClicks : null;
  const conversionRate = metaClicks ? (stats.paid / metaClicks) * 100 : null;
  const cpl = metaSpend !== null && stats.paid ? metaSpend / stats.paid : null;
  const metaStatus = metaInsightsLoading ? "Consultando Meta..." : metaInsightsError ?? (!metaInsights?.configured ? "Integração indisponível" : "No período selecionado");
  const clickLabel = metaInsights?.clickSource === "landing_page_view" ? "Landing page views" : metaInsights?.clickSource === "link_click" ? "Cliques em link" : metaInsights?.clickSource === "outbound_click" ? "Cliques externos" : "Cliques de destino";

  function copyValue(label: string, value: string) {
    void navigator.clipboard?.writeText(value);
    setCopied(label);
    window.setTimeout(() => setCopied((current) => (current === label ? null : current)), 1400);
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-label="Indicadores de leads e Meta Ads">
        <MetricCard icon="users" label="Leads totais" value={originCounts.all.toLocaleString("pt-BR")} detail={fromDate || toDate ? "No período selecionado" : "Respostas do formulário"} />
        <MetricCard icon="target" label="Tráfego pago" value={stats.paid.toLocaleString("pt-BR")} detail={`${originCounts.all ? Math.round((stats.paid / originCounts.all) * 100) : 0}% da base`} />
        <MetricCard icon="leaf" label="Orgânico" value={stats.organic.toLocaleString("pt-BR")} detail={`${originCounts.all ? Math.round((stats.organic / originCounts.all) * 100) : 0}% da base`} />
        <MetricCard icon="calendar" label="Média por dia" value={stats.average} detail={stats.daySpan ? `${originCounts.all} leads em ${stats.daySpan} dias` : "Aguardando novos leads"} />
        <MetricCard icon="card" label="Valor gasto" value={formatCurrency(metaSpend)} detail={metaStatus} />
        <MetricCard icon="target" label="CPC (LP destino)" value={formatCurrency(cpc)} detail={metaSpend !== null && metaClicks ? `${formatCurrency(metaSpend)} / ${formatNumber(metaClicks)} cliques` : metaStatus} />
        <MetricCard icon="link" label="Cliques na LP" value={formatNumber(metaClicks)} detail={metaClicks !== null ? clickLabel : metaStatus} />
        <MetricCard icon="eye" label="Impressões" value={formatNumber(metaImpressions)} detail={metaImpressions !== null ? "Meta Ads no período" : metaStatus} />
        <MetricCard icon="radar" label="Taxa de conversão" value={formatPercent(conversionRate)} detail={metaClicks ? `${stats.paid} leads Meta / ${formatNumber(metaClicks)} cliques` : metaStatus} />
        <MetricCard icon="users" label="CPL" value={formatCurrency(cpl)} detail={stats.paid && metaSpend !== null ? `${stats.paid} leads Meta` : metaStatus} />
      </section>

      <section className="overflow-hidden rounded-2xl border border-border bg-surface shadow-[0_18px_60px_-38px_rgba(0,0,0,.9)]">
        <div className="border-b border-border px-4 py-4 sm:px-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="flex items-center gap-2"><h2 className="text-base font-semibold text-fg">Base de leads</h2><span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-muted">{filteredLeads.length} exibidos</span></div>
              <p className="mt-1 text-xs text-subtle">Clique em uma linha para ver a atribuição completa e o criativo.</p>
            </div>
            <Button type="button" size="sm" variant="secondary" onClick={() => downloadCsv(filteredLeads)} disabled={!filteredLeads.length} className="self-start border-accent/30 text-accent hover:bg-accent/10 xl:self-auto"><Icon name="download" width={15} height={15} />Exportar CSV</Button>
          </div>
          <div className="mt-5 grid gap-2 lg:grid-cols-[minmax(220px,1fr)_auto_auto_auto]">
            <label className="relative block"><span className="sr-only">Buscar lead</span><Icon name="search" width={16} height={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-subtle" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por nome, e-mail, WhatsApp..." className="h-10 w-full rounded-lg border border-border bg-surface-2 pl-9 pr-3 text-sm text-fg outline-none placeholder:text-subtle focus:border-accent/50" /></label>
            <label className="flex h-10 items-center gap-2 rounded-lg border border-border bg-surface-2 px-3 text-xs text-muted"><Icon name="calendar" width={15} height={15} className="text-subtle" /><span className="hidden sm:inline">De</span><input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} aria-label="Data inicial" className="min-w-0 bg-transparent text-xs text-fg outline-none scheme-dark" /></label>
            <label className="flex h-10 items-center gap-2 rounded-lg border border-border bg-surface-2 px-3 text-xs text-muted"><span className="hidden sm:inline">Até</span><input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} aria-label="Data final" className="min-w-0 bg-transparent text-xs text-fg outline-none scheme-dark" /></label>
            <label className="relative flex h-10 items-center gap-2 rounded-lg border border-border bg-surface-2 px-3 text-xs text-muted"><Icon name="filter" width={15} height={15} className="text-subtle" /><span className="sr-only">Ordenação</span><select value={sortOrder} onChange={(event) => setSortOrder(event.target.value as "newest" | "oldest")} className="appearance-none bg-transparent pr-5 text-xs text-fg outline-none"><option value="newest" className="bg-surface">Mais novos</option><option value="oldest" className="bg-surface">Mais antigos</option></select><Icon name="chevron-down" width={13} height={13} className="pointer-events-none absolute right-2 text-subtle" /></label>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2"><span className="mr-1 text-[11px] font-semibold uppercase tracking-widest text-subtle">Origem</span>{(["all", "facebook", "instagram", "organic"] as const).map((filter) => { const labels = { all: "Todos", facebook: "Facebook", instagram: "Instagram", organic: "Orgânico" }; const counts = { all: originCounts.all, facebook: originCounts.facebook, instagram: originCounts.instagram, organic: originCounts.organic }; const active = originFilter === filter; const activeClass = filter === "instagram" ? "border-pink-400/40 bg-pink-400/10 text-pink-300" : "border-accent/40 bg-accent/10 text-accent"; return <button key={filter} type="button" onClick={() => setOriginFilter(filter)} className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${active ? activeClass : "border-border text-muted hover:border-border-strong hover:text-fg"}`}>{labels[filter]} <span className={`ml-1 tabular-nums ${active && filter === "instagram" ? "text-pink-200" : active ? "text-accent" : "text-subtle"}`}>{counts[filter]}</span></button>; })}{(query || fromDate || toDate || originFilter !== "all") && <button type="button" onClick={() => { setQuery(""); setFromDate(""); setToDate(""); setOriginFilter("all"); }} className="ml-auto text-xs font-medium text-subtle underline decoration-border-strong underline-offset-4 hover:text-fg">Limpar filtros</button>}</div>
        </div>

        {filteredLeads.length ? <div className="overflow-x-auto"><table className="w-full min-w-190 border-collapse text-left"><thead><tr className="border-b border-border bg-surface-2/50 text-[10px] font-semibold uppercase tracking-[.12em] text-subtle"><th className="px-5 py-3 font-semibold">Data de entrada</th><th className="px-4 py-3 font-semibold">Origem</th><th className="px-4 py-3 font-semibold">Lead</th><th className="px-4 py-3 font-semibold">E-mail</th><th className="px-4 py-3 font-semibold">WhatsApp</th><th className="px-5 py-3 text-right font-semibold">Abrir</th></tr></thead><tbody>{filteredLeads.map((lead) => { const origin = getOrigin(lead); return <tr key={lead.lead_id} tabIndex={0} onClick={() => setSelectedLead(lead)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedLead(lead); } }} className="group cursor-pointer border-b border-border/70 text-sm transition last:border-0 hover:bg-surface-hover focus:bg-surface-hover focus:outline-none"><td className="whitespace-nowrap px-5 py-4 text-xs text-muted">{formatDate(lead.created_at)}</td><td className="px-4 py-4"><Badge tone={origin.channel === "facebook" ? "info" : origin.channel === "instagram" ? "pink" : "accent"} square={false}>{origin.label}</Badge></td><td className="max-w-47.5 px-4 py-4"><p className="truncate font-semibold text-fg">{lead.name}</p><p className="mt-0.5 truncate text-xs text-subtle">{lead.lead_id}</p></td><td className="max-w-57.5 truncate px-4 py-4 text-muted">{lead.email}</td><td className="whitespace-nowrap px-4 py-4 text-muted">{lead.whatsapp}</td><td className="px-5 py-4 text-right"><span className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-subtle transition group-hover:bg-accent/10 group-hover:text-accent"><Icon name="chevron-right" width={16} height={16} /></span></td></tr>; })}</tbody></table></div> : <div className="flex min-h-48 flex-col items-center justify-center px-6 py-12 text-center"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-surface-2 text-subtle"><Icon name="search" width={19} height={19} /></span><p className="mt-4 text-sm font-medium text-fg">Nenhum lead encontrado</p><p className="mt-1 max-w-sm text-xs text-subtle">Ajuste os filtros ou limpe a busca para voltar a visualizar os contatos.</p></div>}
        <div className="flex items-center justify-between gap-3 border-t border-border bg-surface-2/30 px-5 py-3 text-xs text-subtle"><span>Mostrando {filteredLeads.length} de {leads.length} leads</span><span className="hidden sm:inline">Dados protegidos · acesso administrativo</span></div>
      </section>

      {selectedLead && <div className="fixed inset-0 z-100 flex justify-end bg-black/75 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="lead-detail-title" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedLead(null); }}><div className="flex h-full w-full max-w-2xl flex-col overflow-hidden border-l border-border-strong bg-surface shadow-2xl"><div className="flex items-start justify-between gap-4 border-b border-border px-5 py-5 sm:px-7"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><Badge tone={getOrigin(selectedLead).channel === "facebook" ? "info" : getOrigin(selectedLead).channel === "instagram" ? "pink" : "accent"} square={false}>{getOrigin(selectedLead).label}</Badge><span className="text-xs text-subtle">{formatDate(selectedLead.created_at)}</span></div><h2 id="lead-detail-title" className="mt-3 truncate text-xl font-semibold text-fg">{selectedLead.name}</h2><p className="mt-1 truncate text-sm text-muted">{selectedLead.email}</p></div><button type="button" onClick={() => setSelectedLead(null)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted transition hover:bg-surface-2 hover:text-fg" aria-label="Fechar detalhes"><Icon name="close" width={18} height={18} /></button></div><div className="overflow-y-auto px-5 py-5 sm:px-7 sm:py-6"><div className="grid gap-3 sm:grid-cols-2"><CopyField label="E-mail" value={selectedLead.email} copied={copied} onCopy={copyValue} /><CopyField label="WhatsApp" value={selectedLead.whatsapp} copied={copied} onCopy={copyValue} /><CopyField label="Lead ID" value={selectedLead.lead_id} copied={copied} onCopy={copyValue} /><CopyField label="Data de entrada" value={formatDate(selectedLead.created_at)} copied={copied} onCopy={copyValue} /></div><h3 className="mb-3 mt-7 text-xs font-semibold uppercase tracking-[.12em] text-subtle">Atribuição de marketing</h3><div className="grid gap-3 sm:grid-cols-2"><CopyField label="UTM source / medium" value={[selectedLead.utm_source, selectedLead.utm_medium].filter(Boolean).join(" / ") || null} copied={copied} onCopy={copyValue} /><CopyField label="Campanha" value={selectedLead.campaign_name ?? selectedLead.campaign_id} copied={copied} onCopy={copyValue} /><CopyField label="Conjunto de anúncios" value={selectedLead.adset_name ?? selectedLead.adset_id} copied={copied} onCopy={copyValue} /><CopyField label="Anúncio / criativo" value={selectedLead.ad_name ?? selectedLead.ad_id} copied={copied} onCopy={copyValue} /><CopyField label="Posicionamento" value={selectedLead.placement ?? selectedLead.site_source_name} copied={copied} onCopy={copyValue} /><CopyField label="UTM campaign" value={selectedLead.utm_campaign} copied={copied} onCopy={copyValue} /><CopyField label="UTM content" value={selectedLead.utm_content} copied={copied} onCopy={copyValue} /><CopyField label="UTM term" value={selectedLead.utm_term} copied={copied} onCopy={copyValue} /></div><h3 className="mb-3 mt-7 text-xs font-semibold uppercase tracking-[.12em] text-subtle">Criativo do anúncio</h3><div className="overflow-hidden rounded-xl border border-border bg-surface-2/60">{metaCreativeLoading ? <p className="p-4 text-sm text-subtle">Carregando criativo da Meta...</p> : metaCreativeError ? <p className="p-4 text-sm text-danger">{metaCreativeError}</p> : !selectedLead.ad_id ? <p className="p-4 text-sm text-subtle">Este lead não possui um ad_id capturado para buscar o criativo.</p> : metaCreative ? <div className="grid gap-4 p-3 sm:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]"><div className="flex aspect-video items-center justify-center overflow-hidden rounded-lg bg-surface"><>{(metaCreative.imageUrl ?? metaCreative.thumbnailUrl) ? <img src={metaCreative.imageUrl ?? metaCreative.thumbnailUrl ?? ""} alt={metaCreative.creativeName ?? "Criativo do anúncio"} className="h-full w-full object-cover" /> : <span className="px-4 text-center text-xs text-subtle">A Meta não retornou uma prévia visual para este criativo.</span>}</></div><div className="flex flex-col justify-center gap-3"><div><p className="text-sm font-semibold text-fg">{metaCreative.creativeName ?? selectedLead.ad_name ?? "Criativo da Meta"}</p><p className="mt-1 text-xs text-muted">{metaCreative.adName ?? selectedLead.ad_name ?? "Anúncio sem nome"}</p></div><CopyField label="Creative ID" value={metaCreative.creativeId} copied={copied} onCopy={copyValue} /><CopyField label="Ad ID" value={metaCreative.adId} copied={copied} onCopy={copyValue} /></div></div> : <p className="p-4 text-sm text-subtle">Não foi possível encontrar a prévia deste anúncio.</p>}</div><h3 className="mb-3 mt-7 text-xs font-semibold uppercase tracking-[.12em] text-subtle">Dados da Meta</h3><div className="grid gap-3 sm:grid-cols-2"><CopyField label="fbclid" value={selectedLead.fbclid} copied={copied} onCopy={copyValue} /><CopyField label="fbc" value={selectedLead.fbc} copied={copied} onCopy={copyValue} /><CopyField label="fbp" value={selectedLead.fbp} copied={copied} onCopy={copyValue} /></div></div><div className="flex flex-col-reverse gap-3 border-t border-border bg-surface-2/30 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7"><span className="text-xs text-subtle">Acesso ao produto: <strong className={selectedLead.access_granted ? "text-accent" : "text-muted"}>{selectedLead.access_granted ? "concedido" : "pendente"}</strong></span><LeadAccessButton leadId={selectedLead.lead_id} granted={selectedLead.access_granted} /></div></div></div>}
    </div>
  );
}
