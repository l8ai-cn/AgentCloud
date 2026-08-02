import { create, toBinary } from "@bufbuild/protobuf";
import { describe, expect, it, vi } from "vitest";
import {
  CreateOrganizationConnectionRequestSchema,
  ImportConnectionModelsRequestSchema,
  ImportConnectionModelsResponseSchema,
} from "@proto/ai_resource/v1/ai_resource_pb";
import {
  ModelResourceSchema,
  ProviderConnectionSchema,
} from "@proto/ai_resource/v1/types_pb";

vi.mock("@/lib/wasm-core", () => ({
  getAIResourceService: vi.fn(),
}));

import { getAIResourceService } from "@/lib/wasm-core";
import {
  createOrganizationConnection,
  importConnectionModels,
} from "../connect/aiResourceConnect";
import { fromProviderConnection } from "../facade/aiResource";

describe("AI resource Connect boundary", () => {
  it("encodes owner slug and credentials but returns safe metadata only", async () => {
    const createConnection = vi.fn();
    vi.mocked(getAIResourceService).mockReturnValue({
      createOrganizationConnectionConnect: createConnection,
    } as unknown as ReturnType<typeof getAIResourceService>);
    createConnection.mockResolvedValue(toBinary(ProviderConnectionSchema, create(ProviderConnectionSchema, {
      id: BigInt(9),
      ownerScope: "organization",
      identifier: "openai-main",
      configuredFields: ["api_key"],
    })));

    const result = await createOrganizationConnection({
      orgSlug: "acme",
      identifier: "openai-main",
      providerKey: "openai",
      name: "OpenAI",
      baseUrl: "https://api.openai.com",
      credentials: { api_key: "secret-value" },
    });

    const request = create(CreateOrganizationConnectionRequestSchema, {
      orgSlug: "acme",
      identifier: "openai-main",
      providerKey: "openai",
      name: "OpenAI",
      baseUrl: "https://api.openai.com",
      credentials: { api_key: "secret-value" },
    });
    expect(createConnection).toHaveBeenCalledWith(toBinary(CreateOrganizationConnectionRequestSchema, request));
    expect(result).toMatchObject({ id: 9, configuredFields: ["api_key"] });
    expect(JSON.stringify(result)).not.toContain("secret-value");
    expect(result).not.toHaveProperty("credentials");
  });

  it("rejects connection identifiers that exceed JavaScript's safe integer range", () => {
    expect(() => fromProviderConnection(create(ProviderConnectionSchema, {
      id: BigInt(Number.MAX_SAFE_INTEGER) + BigInt(1),
    }))).toThrow("unsafe provider connection id");
  });

  it("imports every candidate when modelIds is empty", async () => {
    const importModels = vi.fn();
    vi.mocked(getAIResourceService).mockReturnValue({
      importConnectionModelsConnect: importModels,
    } as unknown as ReturnType<typeof getAIResourceService>);
    importModels.mockResolvedValue(toBinary(ImportConnectionModelsResponseSchema, create(ImportConnectionModelsResponseSchema, {
      connectionId: BigInt(7),
      imported: [create(ModelResourceSchema, {
        id: BigInt(9),
        providerConnectionId: BigInt(7),
        identifier: "gpt-4-1",
        modelId: "gpt-4.1",
        displayName: "GPT-4.1",
      })],
    })));

    const result = await importConnectionModels(7);

    expect(importModels).toHaveBeenCalledWith(toBinary(
      ImportConnectionModelsRequestSchema,
      create(ImportConnectionModelsRequestSchema, {
        connectionId: BigInt(7),
        modelIds: [],
      }),
    ));
    expect(result.imported).toMatchObject([{ id: 9, modelId: "gpt-4.1" }]);
  });
});
