import { readFile, writeFile } from "node:fs/promises";

const input = "media-worker/cookies.txt";
const output = "media-worker/youtube-cookies.txt";
const text = await readFile(input, "utf8");
const lines = text.split(/\r?\n/);
const filtered = lines.filter((line) => {
  if (!line || line.startsWith("#")) return true;
  const domain = line.split("\t", 1)[0]?.toLowerCase() ?? "";
  return domain === "youtube.com" || domain.endsWith(".youtube.com");
});
await writeFile(output, filtered.join("\n"), { mode: 0o600 });
console.log(`Arquivo filtrado criado: ${output}`);
