import { describe, expect, it } from "vitest";
import { formatClockTimezoneOffset } from "@/types";
import { getClockParts } from "@/lib/clock";

describe("clock timezone formatting", () => {
  it("formats the same instant using the selected fixed UTC offset", () => {
    const instant = new Date("2026-08-29T11:15:30.000Z");

    expect(getClockParts(instant, 480)).toMatchObject({ h: "19", m: "15", s: "30", day: "29" });
    expect(getClockParts(instant, -420)).toMatchObject({ h: "04", m: "15", s: "30", day: "29" });
  });

  it("rolls the displayed date across midnight", () => {
    const parts = getClockParts(new Date("2026-08-29T23:30:00.000Z"), 480);

    expect(parts).toMatchObject({ h: "07", m: "30", day: "30", month: "08", weekdayLcd: "SUN" });
  });

  it("labels positive and half-hour offsets clearly", () => {
    expect(formatClockTimezoneOffset(480)).toBe("UTC+08:00");
    expect(formatClockTimezoneOffset(-210)).toBe("UTC−03:30");
  });
});
