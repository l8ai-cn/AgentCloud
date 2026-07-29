import { describe, expect, it } from "vitest";

import { resolveSourceTool } from "./index";

describe("source tool catalog", () => {
  it.each([
    ["acp", "Bash", "shell.execute"],
    ["acp", "Read", "filesystem.read"],
    ["acp", "Write", "filesystem.write"],
    ["acp", "Edit", "filesystem.edit"],
    ["acp", "Grep", "filesystem.search"],
    ["acp", "WebFetch", "web.fetch"],
    ["acp", "AskUserQuestion", "interaction.question"],
    ["acp", "shell", "shell.execute"],
    ["acp", "fileChange", "filesystem.change"],
    ["acp", "image_generation", "media.image.generate"],
    ["codex", "Bash", "shell.execute"],
    ["codex", "Read", "filesystem.read"],
    ["codex", "Write", "filesystem.write"],
    ["codex", "shell", "shell.execute"],
    ["codex", "fileChange", "filesystem.change"],
    ["codex", "image_generation", "media.image.generate"],
    ["claude", "Bash", "shell.execute"],
    ["claude", "Read", "filesystem.read"],
    ["claude", "Write", "filesystem.write"],
    ["claude", "Edit", "filesystem.edit"],
    ["claude", "Grep", "filesystem.search"],
    ["claude", "WebFetch", "web.fetch"],
    ["claude", "AskUserQuestion", "interaction.question"],
    ["codex", "web_search_call", "web.search"],
    ["codex", "file_search_call", "filesystem.search"],
    ["codex", "code_interpreter_call", "code.interpret"],
    ["codex", "computer_call", "computer.use"],
    ["codex", "image_generation_call", "media.image.generate"],
    ["codex", "mcp_call", "mcp.call"],
    ["codex", "mcp_list_tools", "mcp.list-tools"],
  ])(
    "maps %s tool %s to its reviewed identity",
    (sourceProtocol, sourceToolName, semanticKey) => {
      expect(resolveSourceTool(sourceProtocol, sourceToolName)).toMatchObject({
        namespace: `agentcloud.${sourceProtocol}`,
        semanticKey,
        schemaVersion: "1",
        sourceToolName,
      });
    },
  );

  it.each([
    ["acp", "shell_exec"],
    ["acp", "bash"],
    ["acp", "ReadFile"],
    ["codex", "shell_exec"],
    ["codex", "bash"],
    ["codex", "ReadFile"],
    ["claude", "bash"],
    ["claude", "shell_exec"],
    ["claude", "ReadFile"],
    ["claude", "Read file"],
    ["claude", "Bash "],
    ["claude", "*"],
    ["claude", "shell"],
    ["claude", "fileChange"],
    ["codex", "Edit"],
    ["codex", "Image generation"],
    ["codex", "prefix-image_generation"],
    ["codex", "web_search"],
    ["codex", "file_search"],
    ["codex", "code_interpreter"],
    ["codex", "computer"],
    ["codex", "mcp_list_tool"],
    ["codex", "MCP_call"],
    ["claude", "web_search_call"],
    ["acp", "code_interpreter_call"],
    ["unknown", "Bash"],
  ])("does not guess %s tool %s", (sourceProtocol, sourceToolName) => {
    expect(resolveSourceTool(sourceProtocol, sourceToolName)).toBeUndefined();
  });
});
