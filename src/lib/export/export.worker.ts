/// <reference lib="webworker" />
import {
  ALL_FORMATS,
  AudioSampleSink,
  AudioSampleSource,
  BufferTarget,
  CanvasSink,
  CanvasSource,
  Input,
  Mp4OutputFormat,
  Output,
  UrlSource,
} from "mediabunny";
import {
  OUT_H,
  OUT_W,
  cropToPixels,
  intersectSegments,
  segmentsTotal,
  slotsFor,
  framingAt,
  outputSegments,
  type EditorState,
} from "./layouts";

export type CaptionCue = { startMs: number; endMs: number; text: string };
export type ExportRequest = { sourceUrl: string; state: EditorState; captions?: CaptionCue[] };
export type ExportMessage =
  | { type: "progress"; value: number }
  | { type: "done"; buffer: ArrayBuffer; duration: number }
  | { type: "error"; message: string };

const ctx = self as unknown as DedicatedWorkerGlobalScope;
const post = (m: ExportMessage, transfer: Transferable[] = []) =>
  ctx.postMessage(m, transfer);

ctx.onmessage = async (e: MessageEvent<ExportRequest>) => {
  try {
    await run(e.data);
  } catch (err) {
    post({ type: "error", message: err instanceof Error ? err.message : String(err) });
  }
};

async function run({ sourceUrl, state, captions = [] }: ExportRequest) {
  const segments = outputSegments(state);
  const length = segmentsTotal(segments);

  const input = new Input({ source: new UrlSource(sourceUrl), formats: ALL_FORMATS });
  const video = await input.getPrimaryVideoTrack();
  if (!video) throw new Error("Fonte sem trilha de vídeo.");
  const audio = await input.getPrimaryAudioTrack();
  const srcW = video.displayWidth;
  const srcH = video.displayHeight;

  const canvas = new OffscreenCanvas(OUT_W, OUT_H);
  const g = canvas.getContext("2d");
  if (!g) throw new Error("OffscreenCanvas 2D indisponível.");

  const output = new Output({
    format: new Mp4OutputFormat({ fastStart: "in-memory" }),
    target: new BufferTarget(),
  });
  const fps = 30;
  const videoSource = new CanvasSource(canvas, {
    codec: "avc",
    bitrate: 8_000_000,
    keyFrameInterval: 2,
    fullCodecString: "avc1.640028",
  });
  output.addVideoTrack(videoSource, { frameRate: fps });

  let audioSource: AudioSampleSource | null = null;
  if (audio) {
    audioSource = new AudioSampleSource({ codec: "aac", bitrate: 128_000 });
    output.addAudioTrack(audioSource);
  }
  await output.start();

  try {
    const sink = new CanvasSink(video, { poolSize: 2 });
    // Cada segmento é posto em sequência na timeline de saída (offset).
    let offset = 0;
    let last = -1;
    for (const { start, end } of segments) {
      for await (const frame of sink.canvases(start, end)) {
        const local = frame.timestamp - start;
        if (local < 0) continue;
        const t = offset + local;
        // Reamostra para fps constante.
        if (t - last < 1 / fps - 1e-3 && last >= 0) continue;
        last = t;
        g.fillStyle = "#000";
        g.fillRect(0, 0, OUT_W, OUT_H);
        // Enquadramento da faixa mais alta que cobre este instante.
        const f = framingAt(state, frame.timestamp);
        for (const s of slotsFor(f.layout, f.camPos)) {
          const c = cropToPixels(f.crops[s.key], srcW, srcH);
          g.drawImage(frame.canvas, c.sx, c.sy, c.sw, c.sh, s.dx, s.dy, s.dw, s.dh);
        }
        const cue = captions.find((x) => frame.timestamp * 1000 >= x.startMs && frame.timestamp * 1000 < x.endMs);
        if (cue) drawCaption(g, cue.text);
        await videoSource.add(t, 1 / fps);
        post({ type: "progress", value: Math.min(0.99, t / length) });
      }
      offset += end - start;
    }

    if (audio && audioSource) {
      const asink = new AudioSampleSink(audio);
      offset = 0;
      for (const { start, end } of segments) {
        // Com áudio separado, só entram os trechos em que vídeo e áudio coincidem.
        const parts = state.audio ? intersectSegments([{ start, end }], state.audio) : [{ start, end }];
        for (const part of parts) {
          for await (const sample of asink.samples(part.start, part.end)) {
            const ts = sample.timestamp;
            if (ts >= part.start && ts < part.end) {
              sample.setTimestamp(offset + (ts - start));
              await audioSource.add(sample);
            }
            sample.close();
          }
        }
        offset += end - start;
      }
    }

    await output.finalize();
  } catch (err) {
    await output.cancel();
    throw err;
  }

  const buffer = (output.target as BufferTarget).buffer;
  if (!buffer) throw new Error("Saída vazia.");
  post({ type: "done", buffer, duration: length }, [buffer]);
}

function drawCaption(g: OffscreenCanvasRenderingContext2D, text: string) {
  const value = text.trim();
  if (!value) return;
  const max = 42;
  const words = value.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > max && line) { lines.push(line); line = word; }
    else line = next;
  }
  if (line) lines.push(line);
  g.save();
  g.font = "700 48px Arial, sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  const lineH = 60;
  const y = OUT_H - 190 - (lines.length - 1) * lineH / 2;
  const width = Math.min(940, Math.max(...lines.map((x) => g.measureText(x).width)) + 56);
  const height = lines.length * lineH + 28;
  g.fillStyle = "rgba(0,0,0,0.78)";
  g.fillRect((OUT_W - width) / 2, y - height / 2, width, height);
  g.fillStyle = "#fff";
  lines.forEach((x, i) => g.fillText(x, OUT_W / 2, y + (i - (lines.length - 1) / 2) * lineH));
  g.restore();
}
