import { describe, expect, it } from "vitest";
import { chooseNextEmotion, resolvedAgentEmotion } from "./agentState";

describe("agent expression state", () => {
  it("gives listening priority and restores the configured expression", () => {
    expect(resolvedAgentEmotion("02", "10", true, true)).toBe("listening");
    expect(resolvedAgentEmotion("02", "10", false, false)).toBe("02");
  });

  it("does not choose the current expression", () => {
    expect(chooseNextEmotion("02", () => 0)).not.toBe("02");
    expect(chooseNextEmotion("41", () => 0.999)).not.toBe("41");
  });
});
