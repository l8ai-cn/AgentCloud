import { describe, expect, it } from "vitest";

import {
  buildMentionPreamble,
  mentionItemKey,
  mentionItemPath,
  mentionMarkerFor,
} from "./mentionSerialize";

describe("mentionSerialize", () => {
  it("formats path, directory slash, and line ranges", () => {
    expect(mentionItemPath({ path: "a.ts", isDir: false })).toBe("a.ts");
    expect(mentionItemPath({ path: "src", isDir: true })).toBe("src/");
    expect(
      mentionItemPath({
        path: "a.ts",
        isDir: false,
        lineRange: { start: 2, end: 4 },
      }),
    ).toBe("a.ts:2-4");
  });

  it("uses codex wording only for codex harnesses", () => {
    expect(mentionMarkerFor("codex-native", "a.ts")).toBe(
      "[Attached file: a.ts]",
    );
    expect(mentionMarkerFor("native-codex", "a.ts")).toBe(
      "[Attached file: a.ts]",
    );
    expect(mentionMarkerFor("claude-native", "a.ts")).toBe("[Attached: a.ts]");
    expect(mentionMarkerFor(null, "a.ts")).toBe("[Attached: a.ts]");
  });

  it("builds a blank-line terminated preamble", () => {
    expect(
      buildMentionPreamble(
        [
          { path: "src", isDir: true },
          { path: "a.ts", isDir: false },
        ],
        "claude-native",
      ),
    ).toBe("[Attached: src/]\n[Attached: a.ts]\n\n");
  });

  it("dedupes by path|isDir|range", () => {
    expect(mentionItemKey({ path: "a", isDir: true })).toBe("a|1|");
    expect(
      mentionItemKey({
        path: "a",
        isDir: false,
        lineRange: { start: 1, end: 2 },
      }),
    ).toBe("a|0|1-2");
  });
});
