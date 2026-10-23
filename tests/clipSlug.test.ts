import { test } from "node:test";
import assert from "node:assert/strict";
import { parseClipChannel, parseClipSlug, pickBestQuality } from "../src/lib/twitch/clip-slug.ts";

test("parseClipSlug aceita URLs e slugs", () => {
  assert.equal(parseClipSlug("AbcDef-123_x"), "AbcDef-123_x");
  assert.equal(parseClipSlug("https://www.twitch.tv/gaules/clip/Foo-Bar"), "Foo-Bar");
  assert.equal(parseClipSlug("https://clips.twitch.tv/Foo"), "Foo");
  assert.equal(parseClipSlug("https://clips.twitch.tv/embed?clip=Foo&parent=x"), "Foo");
  assert.equal(parseClipSlug("m.twitch.tv/clip/Foo"), "Foo");
  assert.equal(parseClipSlug("https://example.com/clip/Foo"), null);
  assert.equal(parseClipSlug("   "), null);
});

test("parseClipChannel extrai o canal em minúsculas", () => {
  assert.equal(parseClipChannel("https://www.twitch.tv/Gaules/clip/Foo"), "gaules");
  assert.equal(parseClipChannel("https://clips.twitch.tv/Foo"), null);
});

test("pickBestQuality prefere a maior altura até 1080 e desempata por fps", () => {
  const q = [
    { quality: "1440", sourceURL: "a" },
    { quality: "1080", sourceURL: "b", frameRate: 30 },
    { quality: "1080", sourceURL: "c", frameRate: 60 },
    { quality: "720", sourceURL: "d" },
  ];
  assert.equal(pickBestQuality(q)?.sourceURL, "c");
  assert.equal(pickBestQuality([]), null);
});
