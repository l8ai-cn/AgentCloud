import { fireEvent, render, screen } from "@testing-library/react";
import { useRef, useState } from "react";
import { describe, expect, it } from "vitest";

import type { WorkspaceFileEntry } from "./workspaceFileSource";
import { useMentionBrowser } from "./useMentionBrowser";
import type { MentionState } from "./mentionToken";

function Harness({ entries }: { entries: WorkspaceFileEntry[] }) {
  const [text, setText] = useState("@");
  const [mention, setMention] = useState<MentionState | null>({
    query: "",
    start: 0,
    end: 1,
  });
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const browser = useMentionBrowser({
    mention,
    setMention,
    mentionEntries: entries,
    text,
    setText,
    textareaRef,
  });
  return (
    <div>
      <textarea
        aria-label="composer"
        onKeyDown={(e) => browser.handleKeyDown(e)}
        ref={textareaRef}
        value={text}
      />
      <div data-testid="index">{browser.mentionIndex}</div>
      <div data-testid="chips">
        {browser.mentionedItems.map((i) => i.path).join(",")}
      </div>
      <div data-testid="text">{text}</div>
    </div>
  );
}

describe("useMentionBrowser", () => {
  const entries: WorkspaceFileEntry[] = [
    { name: "src", path: "src", type: "directory" },
    { name: "a.ts", path: "a.ts", type: "file" },
  ];

  it("Enter drills into a directory and Tab attaches it", () => {
    render(<Harness entries={entries} />);
    const ta = screen.getByLabelText("composer");
    fireEvent.keyDown(ta, { key: "Enter" });
    expect(screen.getByTestId("text").textContent).toBe("@src/");
    fireEvent.keyDown(ta, { key: "Tab" });
    expect(screen.getByTestId("chips").textContent).toBe("src");
  });

  it("ArrowDown cycles selection then attaches the file", () => {
    render(<Harness entries={entries} />);
    const ta = screen.getByLabelText("composer");
    fireEvent.keyDown(ta, { key: "ArrowDown" });
    expect(screen.getByTestId("index").textContent).toBe("1");
    fireEvent.keyDown(ta, { key: "Enter" });
    expect(screen.getByTestId("chips").textContent).toBe("a.ts");
  });
});
