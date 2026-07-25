import { describe, expect, it } from "vitest";

import { rankMentionEntries } from "./mentionRanking";

describe("rankMentionEntries", () => {
  it("filters, prefers directories, then localeCompare, then caps", () => {
    const ranked = rankMentionEntries(
      [
        { name: "foo.ts", type: "file" },
        { name: "food", type: "directory" },
        { name: "bar.ts", type: "file" },
        { name: "foolish", type: "directory" },
      ],
      "fo",
      2,
    );
    expect(ranked.map((e) => e.name)).toEqual(["food", "foolish"]);
  });
});
