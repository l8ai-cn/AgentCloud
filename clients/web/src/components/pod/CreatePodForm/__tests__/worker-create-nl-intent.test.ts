import { describe, expect, it } from "vitest";
import {
  createOptions,
  modelResource,
} from "./test-utils";
import {
  draftFromNlIntent,
  resolveWorkerCreateNlIntent,
} from "../worker-create-nl-intent";
import { completeDraft } from "./test-utils";

function kimiModel(id = 77, modelId = "kimi-k2-thinking", displayName = "Kimi K2") {
  return {
    ...modelResource(),
    resource: {
      ...modelResource().resource!,
      id,
      identifier: modelId,
      modelId,
      displayName,
    },
  };
}

describe("resolveWorkerCreateNlIntent", () => {
  it("resolves Chinese kimi + codex intent and prefers code models", () => {
    const intent = resolveWorkerCreateNlIntent(
      "帮我创建一个配置好kimi的codex",
      createOptions(),
      [
        kimiModel(143, "kimi-k2.6", "kimi-k2.6"),
        kimiModel(144, "kimi-k2.7-code", "kimi-k2.7-code"),
        modelResource(),
      ],
    );
    expect(intent.blockingReason).toBeUndefined();
    expect(intent.workerTypeSlug).toBe("codex-cli");
    expect(intent.modelResourceId).toBe(144);
    expect(intent.alias).toBe("codex-kimi");
  });

  it("blocks when codex is not selectable", () => {
    const options = createOptions();
    options.worker_types[0] = {
      ...options.worker_types[0],
      selectable: false,
      blocking_reason: "No online Runner currently supports this worker type",
    };
    const intent = resolveWorkerCreateNlIntent(
      "create a kimi codex",
      options,
      [kimiModel()],
    );
    expect(intent.blockingReason).toContain("No online Runner");
  });

  it("blocks when kimi model is missing", () => {
    const intent = resolveWorkerCreateNlIntent(
      "帮我创建一个配置好kimi的codex",
      createOptions(),
      [modelResource()],
    );
    expect(intent.blockingReason).toBe("model_not_found");
  });
});

describe("draftFromNlIntent", () => {
  it("applies type and model onto the draft", () => {
    const intent = resolveWorkerCreateNlIntent(
      "Help me create a Codex configured with Kimi",
      createOptions(),
      [kimiModel()],
    );
    const draft = draftFromNlIntent(
      completeDraft(),
      intent,
      createOptions(),
      [kimiModel()],
      [],
    );
    expect(draft.worker_type_slug).toBe("codex-cli");
    expect(draft.model_resource_id).toBe(77);
    expect(draft.alias).toBe("codex-kimi");
  });
});
