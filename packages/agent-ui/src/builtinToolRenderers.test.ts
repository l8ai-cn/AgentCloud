import { createBuiltinToolRenderers } from "./builtinToolRenderers";
import { localizeToolText } from "./toolLocalization";

describe("createBuiltinToolRenderers", () => {
  const registry = createBuiltinToolRenderers();

  it("renders a canonical semantic key whichever protocol emitted it", () => {
    for (const namespace of [
      "agentcloud.acp",
      "agentcloud.claude",
      "agentcloud.codex",
      "agentcloud.runner",
    ]) {
      const renderer = registry.lookup({
        namespace,
        schemaVersion: "1",
        semanticKey: "shell.execute",
      });

      expect(renderer?.presentation?.label).toBe("Shell");
      expect(renderer?.presentation?.inputLabel).toBe("Command");
      expect(renderer?.presentation?.outputLabel).toBe("Output");
    }
  });

  it("leaves unknown tools unregistered so they keep raw evidence", () => {
    expect(
      registry.lookup({
        namespace: "agentcloud.codex",
        schemaVersion: "1",
        semanticKey: "tool.custom",
      }),
    ).toBeUndefined();
  });

  it("localizes every registered label", () => {
    const labels = ["shell.execute", "filesystem.change", "web.search"].map(
      (semanticKey) =>
        registry.lookup({
          namespace: "agentcloud.codex",
          schemaVersion: "1",
          semanticKey,
        })?.presentation?.label ?? "",
    );

    expect(labels.map(localizeToolText)).toEqual([
      "执行命令",
      "文件变更",
      "网页搜索",
    ]);
  });
});
