import { describe, expect, it } from "vitest";

import { parseWorkspaceFileList } from "./parseWorkspaceFileList";

describe("parseWorkspaceFileList", () => {
  it("keeps only file/directory rows with name+path", () => {
    expect(
      parseWorkspaceFileList({
        data: [
          { name: "src", path: "src", type: "directory" },
          { name: "a.ts", path: "a.ts", type: "file" },
          { name: "bad", path: "bad", type: "symlink" },
          { path: "missing-name", type: "file" },
        ],
      }),
    ).toEqual([
      { name: "src", path: "src", type: "directory" },
      { name: "a.ts", path: "a.ts", type: "file" },
    ]);
  });
});
