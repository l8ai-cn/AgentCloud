import { describe, expect, it } from "vitest";
import {
  modelBindingNameForResourceId,
  resourceIdFromModelBindingName,
} from "./model-binding-resource-name";

describe("model binding resource name", () => {
  it("builds and parses deterministic ModelBinding names", () => {
    expect(modelBindingNameForResourceId(42)).toBe("model-42");
    expect(resourceIdFromModelBindingName("model-42")).toBe(42);
  });

  it("rejects non-deterministic names", () => {
    expect(resourceIdFromModelBindingName("coding-primary")).toBeUndefined();
    expect(resourceIdFromModelBindingName("model-0")).toBeUndefined();
  });
});
