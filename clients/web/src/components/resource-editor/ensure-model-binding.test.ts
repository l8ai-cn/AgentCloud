import { beforeEach, describe, expect, it, vi } from "vitest";
import { create } from "@bufbuild/protobuf";
import {
  PlanResourceResponseSchema,
  ValidateResourceResponseSchema,
} from "@proto/orchestration_resource/v1/orchestration_resource_queries_pb";
import {
  ResourceOperation,
  ResourceSchema,
} from "@proto/orchestration_resource/v1/orchestration_resource_types_pb";

const api = vi.hoisted(() => ({
  validateResource: vi.fn(),
  planResource: vi.fn(),
  applyBindingResourcePlan: vi.fn(),
}));

vi.mock("@/lib/api/facade/orchestrationResource", () => api);

import { ensureModelBinding } from "./ensure-model-binding";

describe("ensureModelBinding", () => {
  beforeEach(() => {
    Object.values(api).forEach((method) => method.mockReset());
  });

  it("validates, plans, and applies a ModelBinding for the model resource", async () => {
    api.validateResource.mockResolvedValue(create(
      ValidateResourceResponseSchema,
      { operation: ResourceOperation.CREATE, issues: [] },
    ));
    api.planResource.mockResolvedValue(create(PlanResourceResponseSchema, {
      plan: { planId: "binding-plan" },
      issues: [],
    }));
    api.applyBindingResourcePlan.mockResolvedValue(create(ResourceSchema, {
      revision: 3n,
    }));

    await expect(ensureModelBinding("acme", 101, "GPT · primary"))
      .resolves.toEqual({
        kind: "ModelBinding",
        name: "model-101",
        revision: 3,
      });

    const document = api.validateResource.mock.calls[0][1];
    const draft = JSON.parse(document.content as string);
    expect(draft).toMatchObject({
      kind: "ModelBinding",
      metadata: {
        name: "model-101",
        namespace: "acme",
        displayName: "GPT · primary",
      },
      spec: { resourceId: 101 },
    });
    expect(api.applyBindingResourcePlan).toHaveBeenCalledWith(
      "acme",
      "binding-plan",
    );
  });
});
