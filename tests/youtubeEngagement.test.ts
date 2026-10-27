import { after, test } from "node:test";
import assert from "node:assert/strict";
import { parseChannel, parseVideo } from "../src/lib/youtube/parse.ts";
import {
  computeVideoEngagement,
  getChannelEngagement,
  getVideoEngagement,
  isoDurationToSeconds,
  tierOf,
  validateVideo,
} from "../src/lib/youtube/engagement.ts";
import type { YtVideo } from "../src/lib/youtube/api.ts";

const NOW = new Date("2026-01-10T00:00:00Z");
const CHANNEL_ID = "UC" + "a".repeat(22);

function hoursAgo(h: number): string {
  return new Date(NOW.getTime() - h * 36e5).toISOString();
}

function video(
  id: string,
  stats: YtVideo["statistics"],
  extra: { duration?: string; ageHours?: number; live?: "none" | "live" | "upcoming" } = {},
): YtVideo {
  return {
    id,
    snippet: {
      title: `Vídeo ${id}`,
      channelId: CHANNEL_ID,
      channelTitle: "Canal Teste",
      publishedAt: hoursAgo(extra.ageHours ?? 240),
      liveBroadcastContent: extra.live ?? "none",
    },
    statistics: stats,
    contentDetails: { duration: extra.duration ?? "PT10M" },
  };
}

const VIDEOS: YtVideo[] = [
  // longo, ER 6% → alto
  video("aaaaaaaaaaa", { viewCount: "1000", likeCount: "50", commentCount: "10" }, { ageHours: 240 }),
  // Short, ER 2% → médio
  video("bbbbbbbbbbb", { viewCount: "2000", likeCount: "40", commentCount: "0" }, { duration: "PT45S", ageHours: 120 }),
  // ao vivo → pulado
  video("ccccccccccc", { viewCount: "500", likeCount: "5", commentCount: "1" }, { live: "live", ageHours: 72 }),
  // recente demais → pulado
  video("ddddddddddd", { viewCount: "300", likeCount: "30", commentCount: "3" }, { ageHours: 10 }),
  // curtidas ocultas → pulado
  video("eeeeeeeeeee", { viewCount: "800", commentCount: "5" }, { ageHours: 300 }),
];

const realFetch = globalThis.fetch;
after(() => {
  globalThis.fetch = realFetch;
});

// Fetch falso que imita a Data API v3 para /videos, /channels e /playlistItems.
globalThis.fetch = (async (input: string | URL | Request) => {
  const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
  const json = (body: unknown) => new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json" } });
  if (url.pathname.endsWith("/videos")) {
    const ids = (url.searchParams.get("id") ?? "").split(",");
    return json({ items: VIDEOS.filter((v) => ids.includes(v.id)) });
  }
  if (url.pathname.endsWith("/channels")) {
    return json({
      items: [
        {
          id: CHANNEL_ID,
          snippet: { title: "Canal Teste", customUrl: "@canalteste" },
          statistics: { subscriberCount: "10000", hiddenSubscriberCount: false, viewCount: "4600", videoCount: "5" },
          contentDetails: { relatedPlaylists: { uploads: "UU" + "a".repeat(22) } },
        },
      ],
    });
  }
  if (url.pathname.endsWith("/playlistItems")) {
    return json({ items: VIDEOS.map((v) => ({ contentDetails: { videoId: v.id } })) });
  }
  return new Response(JSON.stringify({ error: { message: "not found" } }), { status: 404 });
}) as typeof fetch;

test("parseVideo aceita ID, links curtos, Shorts e embeds", () => {
  assert.deepEqual(parseVideo("kghRIM9dA8o"), { videoId: "kghRIM9dA8o" });
  assert.deepEqual(parseVideo("https://youtu.be/kghRIM9dA8o?t=10"), { videoId: "kghRIM9dA8o" });
  assert.deepEqual(parseVideo("https://www.youtube.com/watch?v=kghRIM9dA8o&list=x"), { videoId: "kghRIM9dA8o" });
  assert.deepEqual(parseVideo("youtube.com/shorts/kghRIM9dA8o"), { videoId: "kghRIM9dA8o" });
  assert.deepEqual(parseVideo("https://m.youtube.com/embed/kghRIM9dA8o"), { videoId: "kghRIM9dA8o" });
  assert.equal(parseVideo("https://example.com/watch?v=kghRIM9dA8o"), null);
  assert.equal(parseVideo("curto"), null);
});

test("parseChannel reconhece ID, @handle, /user e /c", () => {
  assert.deepEqual(parseChannel(CHANNEL_ID), { kind: "id", value: CHANNEL_ID });
  assert.deepEqual(parseChannel("@canalteste"), { kind: "handle", value: "@canalteste" });
  assert.deepEqual(parseChannel("https://www.youtube.com/@canalteste/videos"), { kind: "handle", value: "@canalteste" });
  assert.deepEqual(parseChannel(`youtube.com/channel/${CHANNEL_ID}`), { kind: "id", value: CHANNEL_ID });
  assert.deepEqual(parseChannel("https://youtube.com/user/antigo"), { kind: "username", value: "antigo" });
  assert.deepEqual(parseChannel("https://youtube.com/c/Custom"), { kind: "custom", value: "Custom" });
  assert.equal(parseChannel("https://youtube.com/watch?v=kghRIM9dA8o"), null);
});

test("isoDurationToSeconds converte ISO 8601", () => {
  assert.equal(isoDurationToSeconds("PT1H2M3S"), 3723);
  assert.equal(isoDurationToSeconds("PT45S"), 45);
  assert.equal(isoDurationToSeconds("P1DT2H"), 93600);
  assert.equal(isoDurationToSeconds("abc"), null);
  assert.equal(isoDurationToSeconds(undefined), null);
});

test("tierOf usa as faixas padrão", () => {
  assert.equal(tierOf(5), "alto");
  assert.equal(tierOf(2), "medio");
  assert.equal(tierOf(1.99), "baixo");
  assert.equal(tierOf(null), "indefinido");
  assert.equal(tierOf(3, { high: 3, medium: 1 }), "alto");
});

test("computeVideoEngagement calcula ER e flags", () => {
  const e = computeVideoEngagement(VIDEOS[0]!, { now: NOW });
  assert.equal(e.er, 6);
  assert.equal(e.erLikes, 5);
  assert.equal(e.erComments, 1);
  assert.equal(e.tier, "alto");
  assert.equal(e.isShortLikely, false);
  assert.equal(e.ageHours, 240);
  assert.equal(e.viewsPerHour, 4.17);
  assert.equal(e.estimatedRevenueUsd, 0.25);
  assert.deepEqual(e.flags, []);

  const hidden = computeVideoEngagement(VIDEOS[4]!, { now: NOW });
  assert.equal(hidden.likes, null);
  assert.equal(hidden.er, 0.63);
  assert.ok(hidden.flags.includes("curtidas_ocultas"));

  const empty = computeVideoEngagement(video("fffffffffff", { viewCount: "0" }, { ageHours: 1 }), { now: NOW });
  assert.equal(empty.er, null);
  assert.equal(empty.tier, "indefinido");
  assert.deepEqual(empty.flags, ["curtidas_ocultas", "comentarios_desativados", "video_recente", "sem_views"]);
});

test("getVideoEngagement resolve link e trata erros", async () => {
  const e = await getVideoEngagement("https://youtu.be/bbbbbbbbbbb", { apiKey: "test" });
  assert.equal(e.videoId, "bbbbbbbbbbb");
  assert.equal(e.er, 2);
  assert.equal(e.isShortLikely, true);

  await assert.rejects(getVideoEngagement("lixo", { apiKey: "test" }), { status: 400 });
  await assert.rejects(getVideoEngagement("zzzzzzzzzzz", { apiKey: "test" }), { status: 404 });
});

test("getChannelEngagement agrega, separa Shorts e pula casos ruins", async () => {
  const c = await getChannelEngagement(CHANNEL_ID, { apiKey: "test", now: NOW });
  assert.equal(c.channelId, CHANNEL_ID);
  assert.equal(c.handle, "@canalteste");
  assert.equal(c.subscribers, 10000);
  assert.equal(c.sample.analyzed, 2);
  assert.deepEqual(
    c.sample.skipped.map((s) => s.reason).sort(),
    ["ao_vivo_ou_agendado", "curtidas_ocultas", "menos_de_48h"],
  );
  assert.equal(c.all.videos, 2);
  assert.equal(c.all.erWeighted, 3.33); // (60 + 40) / 3000
  assert.equal(c.long.videos, 1);
  assert.equal(c.shorts.videos, 1);
  assert.equal(c.best?.videoId, "aaaaaaaaaaa");
  assert.equal(c.worst?.videoId, "bbbbbbbbbbb");
  assert.equal(c.quotaUnits, 3); // channels + playlistItems + videos
  assert.equal(c.resolvedVia, "id");
  assert.equal(c.estimatedRevenueUsd, 1.15);
  assert.equal(c.videos[0]?.validation?.status, "not_validated");
  assert.equal(c.videos[1]?.validation?.status, "not_validated");
});

test("validateVideo exige maturidade e supera a base do canal", () => {
  assert.equal(validateVideo({ ageHours: 72, views: 1500, er: 5 }, 1000, 3).status, "validated");
  assert.equal(validateVideo({ ageHours: 24, views: 1500, er: 5 }, 1000, 3).status, "insufficient_data");
  assert.equal(validateVideo({ ageHours: 72, views: 1000, er: 5 }, 1000, 3).status, "not_validated");
  assert.equal(validateVideo({ ageHours: 72, views: 1500, er: null }, 1000, 3).status, "insufficient_data");
});

test("getChannelEngagement aceita link de vídeo como entrada", async () => {
  const c = await getChannelEngagement("https://youtu.be/aaaaaaaaaaa", { apiKey: "test", now: NOW });
  assert.equal(c.channelId, CHANNEL_ID);
  assert.equal(c.resolvedVia, "video");
});
