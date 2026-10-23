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
  slotsFor,
  type EditorState,
} from "./layouts";

export type ExportRequest = { sourceUrl: string; state: EditorState };
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

async function run({ sourceUrl, state }: ExportRequest) {
  const { start, end } = state.trim;
  const length = end - start;

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
    const slots = slotsFor(state.layout, state.camPos);
    let last = -1;
    for await (const frame of sink.canvases(start, end)) {
      const t = frame.timestamp - start;
      if (t < 0) continue;
      // Reamostra para fps constante.
      if (t - last < 1 / fps - 1e-3 && last >= 0) continue;
      last = t;
      g.fillStyle = "#000";
      g.fillRect(0, 0, OUT_W, OUT_H);
      for (const s of slots) {
        const c = cropToPixels(state.crops[s.key], srcW, srcH);
        g.drawImage(frame.canvas, c.sx, c.sy, c.sw, c.sh, s.dx, s.dy, s.dw, s.dh);
      }
      await videoSource.add(t, 1 / fps);
      post({ type: "progress", value: Math.min(0.99, t / length) });
    }

    if (audio && audioSource) {
      const asink = new AudioSampleSink(audio);
      for await (const sample of asink.samples(start, end)) {
        const ts = sample.timestamp - start;
        if (ts >= 0) {
          sample.setTimestamp(ts);
          await audioSource.add(sample);
        }
        sample.close();
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
