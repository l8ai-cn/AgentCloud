import { describe, expect, it } from "vitest";

import { detectMentionAt, parseMentionToken } from "./mentionToken";

describe("detectMentionAt", () => {
  it("detects @ at start and after whitespace", () => {
    expect(detectMentionAt("@fo", 3)).toEqual({
      query: "fo",
      start: 0,
      end: 3,
    });
    expect(detectMentionAt("see @src/", 9)).toEqual({
      query: "src/",
      start: 4,
      end: 9,
    });
  });

  it("closes when a trailing space ends the token", () => {
    expect(detectMentionAt("@fo ", 4)).toBeNull();
  });
});

describe("parseMentionToken", () => {
  it("splits directory browse path from filter", () => {
    expect(parseMentionToken("src/fo")).toEqual({ dir: "src", filter: "fo" });
    expect(parseMentionToken("src/")).toEqual({ dir: "src", filter: "" });
    expect(parseMentionToken("fo")).toEqual({ dir: "", filter: "fo" });
  });
});
