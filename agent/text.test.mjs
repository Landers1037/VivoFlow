import test from "node:test";
import assert from "node:assert/strict";
import { isPrivateHost, normalizeText, removeWakeWord, safeUrl, whisperModelForService } from "./text.mjs";

test("normalizes control whitespace without changing Chinese text", () => {
  assert.equal(normalizeText("  你好\n\u0000世界  "), "你好 世界");
});

test("removes a wake word and preserves the spoken question", () => {
  assert.equal(removeWakeWord("小薇 小薇，今天天气怎么样？", "小薇小薇"), "今天天气怎么样？");
  assert.equal(removeWakeWord("请小薇小薇提醒我", "小薇小薇"), "提醒我");
  assert.equal(removeWakeWord("今天天气怎么样", "小薇小薇"), null);
});

test("rejects local and non-http targets", () => {
  for (const host of ["localhost", "127.0.0.1", "10.0.0.2", "172.16.0.1", "192.168.1.2", "2130706433", "::1", "fc00::1"]) {
    assert.equal(isPrivateHost(host), true, host);
  }
  assert.throws(() => safeUrl("file:///C:/secret.txt"), /unsafe_url/);
  assert.throws(() => safeUrl("http://127.0.0.1:11434/api/tags"), /unsafe_url/);
  assert.equal(safeUrl("https://example.com/path").protocol, "https:");
  assert.equal(isPrivateHost("8.8.8.8"), false);
  assert.equal(isPrivateHost("192.168.1.20"), true);
  assert.equal(isPrivateHost("127.1"), true);
});

test("maps independent Whisper download tasks to their model", () => {
  assert.equal(whisperModelForService("whisper-base", "medium"), "base");
  assert.equal(whisperModelForService("whisper-small", "base"), "small");
  assert.equal(whisperModelForService("whisper-medium", "base"), "medium");
  assert.equal(whisperModelForService("whisper", "medium"), "medium");
  assert.equal(whisperModelForService("chattts", "small"), null);
  assert.throws(() => whisperModelForService("whisper-large", "small"), /unknown_whisper_model/);
});
