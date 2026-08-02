import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  completeDraft,
  createOptions,
  modelResource,
} from "./test-utils";
import { launchWorkerFromNaturalLanguage } from "../worker-create-ai-launch";

const mockFill = vi.fn();
const mockPreflight = vi.fn();
const mockCreate = vi.fn();

vi.mock("@/lib/api", () => ({
  podApi: {
    fillWorkerDraft: (...args: unknown[]) => mockFill(...args),
    preflightWorker: (...args: unknown[]) => mockPreflight(...args),
    create: (...args: unknown[]) => mockCreate(...args),
  },
}));

vi.mock("@/lib/terminal-size", () => ({
  estimateWorkspaceTerminalSize: () => ({ cols: 120, rows: 40 }),
}));

function kimiModel() {
  return {
    ...modelResource(),
    resource: {
      ...modelResource().resource!,
      id: 77,
      identifier: "kimi-k2",
      modelId: "kimi-k2-thinking",
      displayName: "Kimi K2",
    },
  };
}

describe("launchWorkerFromNaturalLanguage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFill.mockRejectedValue(new Error("generation unavailable"));
    mockPreflight.mockResolvedValue({
      issues: [],
      resolved_spec_json: '{"ok":true}',
    });
    mockCreate.mockResolvedValue({
      pod: { id: 9, pod_key: "codex-kimi-1", status: "initializing" },
    });
  });

  it("creates codex+kimi even when AI fill fails", async () => {
    const result = await launchWorkerFromNaturalLanguage({
      prompt: "帮我创建一个配置好kimi的codex",
      draft: completeDraft(),
      options: createOptions(),
      models: [kimiModel()],
      configBundles: [],
      ticketSlug: "TASK-1",
    });

    expect(result.draft.worker_type_slug).toBe("codex-cli");
    expect(result.draft.model_resource_id).toBe(77);
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        ticket_slug: "TASK-1",
        worker_spec: expect.objectContaining({
          worker_type_slug: "codex-cli",
          model_resource_id: 77,
        }),
      }),
    );
    expect(result.pod.pod_key).toBe("codex-kimi-1");
  });

  it("keeps intent model when fill returns a different model", async () => {
    mockFill.mockResolvedValue({
      draft: { ...completeDraft(), model_resource_id: 42, alias: "filled" },
      issues: [],
    });
    const result = await launchWorkerFromNaturalLanguage({
      prompt: "create kimi codex",
      draft: completeDraft(),
      options: createOptions(),
      models: [kimiModel()],
      configBundles: [],
    });
    expect(result.draft.model_resource_id).toBe(77);
    expect(result.draft.alias).toBe("codex-kimi");
  });
});
