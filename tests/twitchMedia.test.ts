import { test } from "node:test";
import assert from "node:assert/strict";
import { parseTwitchUrl } from "../src/lib/twitch/media/gql.ts";
import { pickClipQuality, type ClipQuality } from "../src/lib/twitch/media/clip.ts";
import {
  buildWindowPlaylist,
  parseMaster,
  parseMediaPlaylist,
  pickVariant,
  selectWindow,
  type Segment,
} from "../src/lib/twitch/media/vod.ts";

const SLUG = "SpicyBraveCatPogChamp-AbC123xyz";

test("parseTwitchUrl reconhece clips e VODs", () => {
  assert.deepEqual(parseTwitchUrl(`https://clips.twitch.tv/${SLUG}`), { kind: "clip", slug: SLUG });
  assert.deepEqual(parseTwitchUrl(`clips.twitch.tv/embed?clip=${SLUG}&parent=x`), { kind: "clip", slug: SLUG });
  assert.deepEqual(parseTwitchUrl(`https://www.twitch.tv/gaules/clip/${SLUG}?filter=clips`), { kind: "clip", slug: SLUG });
  assert.deepEqual(parseTwitchUrl(`https://m.twitch.tv/gaules/clip/${SLUG}`), { kind: "clip", slug: SLUG });
  assert.deepEqual(parseTwitchUrl("https://www.twitch.tv/videos/2123456789?t=1h2m3s"), { kind: "vod", id: "2123456789" });
  assert.deepEqual(parseTwitchUrl(SLUG), { kind: "clip", slug: SLUG });
});

test("parseTwitchUrl rejeita entradas inválidas", () => {
  assert.equal(parseTwitchUrl(""), null);
  assert.equal(parseTwitchUrl("https://www.twitch.tv/gaules"), null);
  assert.equal(parseTwitchUrl("https://www.twitch.tv/videos/abc"), null);
  assert.equal(parseTwitchUrl(`https://youtube.com/clip/${SLUG}`), null);
  assert.equal(parseTwitchUrl("curto"), null);
});

test("pickClipQuality respeita a altura máxima e prefere avc1", () => {
  const list: ClipQuality[] = [
    { quality: "1440", frameRate: 60, url: "u1440" },
    { quality: "1080", frameRate: 60, codecs: "hev1.1", url: "u1080h" },
    { quality: "1080", frameRate: 60, codecs: "avc1.64002A", url: "u1080a" },
    { quality: "720", frameRate: 60, url: "u720" },
    { quality: "360", frameRate: 30, url: "u360" },
  ];
  assert.equal(pickClipQuality(list)?.url, "u1080a");
  assert.equal(pickClipQuality(list, 720)?.url, "u720");
  assert.equal(pickClipQuality(list, 100)?.url, "u360");
  assert.equal(pickClipQuality([]), undefined);
});

const MASTER = [
  "#EXTM3U",
  '#EXT-X-MEDIA:TYPE=VIDEO,GROUP-ID="chunked",NAME="1080p60 (source)",AUTOSELECT=YES,DEFAULT=YES',
  '#EXT-X-STREAM-INF:BANDWIDTH=8000000,RESOLUTION=1920x1080,CODECS="avc1.64002A,mp4a.40.2",VIDEO="chunked"',
  "https://cdn.example/chunked/index-dvr.m3u8",
  '#EXT-X-MEDIA:TYPE=VIDEO,GROUP-ID="720p60",NAME="720p60",AUTOSELECT=YES,DEFAULT=YES',
  '#EXT-X-STREAM-INF:BANDWIDTH=3400000,RESOLUTION=1280x720,CODECS="avc1.4D401F,mp4a.40.2",VIDEO="720p60"',
  "https://cdn.example/720p60/index-dvr.m3u8",
  '#EXT-X-MEDIA:TYPE=VIDEO,GROUP-ID="audio_only",NAME="Audio Only",AUTOSELECT=NO,DEFAULT=NO',
  '#EXT-X-STREAM-INF:BANDWIDTH=160000,CODECS="mp4a.40.2",VIDEO="audio_only"',
  "https://cdn.example/audio_only/index-dvr.m3u8",
  "",
].join("\n");

test("parseMaster extrai variantes ordenadas por bitrate", () => {
  const v = parseMaster(MASTER);
  assert.equal(v.length, 3);
  assert.equal(v[0]!.name, "1080p60 (source)");
  assert.equal(v[0]!.resolution, "1920x1080");
  assert.equal(v[0]!.url, "https://cdn.example/chunked/index-dvr.m3u8");
  assert.equal(v[1]!.name, "720p60");
  assert.equal(v[2]!.name, "Audio Only");
});

test("pickVariant escolhe a maior altura permitida e ignora áudio", () => {
  const v = parseMaster(MASTER);
  assert.equal(pickVariant(v).name, "1080p60 (source)");
  assert.equal(pickVariant(v, 720).name, "720p60");
  assert.equal(pickVariant(v, 100).name, "720p60");
  assert.throws(() => pickVariant([]), { status: 502 });
});

const MEDIA = [
  "#EXTM3U",
  "#EXT-X-VERSION:3",
  "#EXT-X-TARGETDURATION:10",
  "#EXTINF:10.000,",
  "0.ts",
  "#EXTINF:10.000,",
  "1.ts",
  "#EXTINF:10.000,",
  "2-muted.ts",
  "#EXTINF:4.500,",
  "https://outro.cdn/3.ts",
  "#EXT-X-ENDLIST",
].join("\n");

test("parseMediaPlaylist acumula tempos e resolve URLs relativas", () => {
  const segs = parseMediaPlaylist(MEDIA, "https://cdn.example/chunked/index-dvr.m3u8?token=x");
  assert.equal(segs.length, 4);
  assert.deepEqual(segs[0], { index: 0, start: 0, duration: 10, url: "https://cdn.example/chunked/0.ts" });
  assert.equal(segs[2]!.start, 20);
  assert.equal(segs[2]!.url, "https://cdn.example/chunked/2-muted.ts");
  assert.equal(segs[3]!.start, 30);
  assert.equal(segs[3]!.url, "https://outro.cdn/3.ts");
});

test("selectWindow pega só os segmentos da janela e calcula o trim", () => {
  const segs: Segment[] = parseMediaPlaylist(MEDIA, "https://cdn.example/chunked/index-dvr.m3u8");
  const w = selectWindow(segs, 12, 25);
  assert.deepEqual(w.segments.map((s) => s.index), [1, 2]);
  assert.equal(w.trimStart, 2);
  assert.equal(w.duration, 13);

  // Fronteira exata: o segmento que termina em 10 não entra.
  assert.deepEqual(selectWindow(segs, 10, 20).segments.map((s) => s.index), [1]);

  assert.throws(() => selectWindow(segs, 20, 20), { status: 400 });
  assert.throws(() => selectWindow(segs, 100, 120), { status: 400 });
});

test("buildWindowPlaylist gera um HLS VOD válido", () => {
  const segs = parseMediaPlaylist(MEDIA, "https://cdn.example/chunked/index-dvr.m3u8");
  const text = buildWindowPlaylist(segs.slice(2));
  const lines = text.split("\n");
  assert.equal(lines[0], "#EXTM3U");
  assert.ok(lines.includes("#EXT-X-TARGETDURATION:10"));
  assert.ok(lines.includes("#EXT-X-PLAYLIST-TYPE:VOD"));
  assert.ok(lines.includes("#EXTINF:4.500,"));
  assert.ok(lines.includes("https://cdn.example/chunked/2-muted.ts"));
  assert.equal(lines.at(-2), "#EXT-X-ENDLIST");
});
