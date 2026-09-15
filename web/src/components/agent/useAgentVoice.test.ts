import { describe, expect, it } from "vitest";
import { normalizeWakeText, removeWakeWord } from "./useAgentVoice";

describe("agent wake word handling", () => {
  it("ignores punctuation and whitespace", () => {
    expect(normalizeWakeText("小薇，小薇！")).toBe("小薇小薇");
    expect(removeWakeWord("小薇，小薇，打开音乐", "小薇小薇")).toBe("打开音乐");
  });

  it("keeps only the spoken content after a wake word", () => {
    expect(removeWakeWord("请小薇小薇提醒我", "小薇小薇")).toBe("提醒我");
    expect(removeWakeWord("天气怎么样", "小薇小薇")).toBeNull();
  });
});
