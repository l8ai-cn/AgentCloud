// Proto roundtrip tests — opaque-JSON state schemas
// (mesh / app / blockstore / auth). These schemas carry a single
// `xxx_json: string` field that the renderer JSON.stringifies and the
// Rust state deserialises with serde_json. The proto roundtrip verifies
// the envelope; the payload is opaque to both sides.
//
// Companion file `protoRoundtrip.test.ts` covers entity-heavy schemas
// (runner / autopilot / repo).

import { describe, it, expect } from "vitest";
import { create, toBinary, fromBinary } from "@bufbuild/protobuf";

import { ReplaceTopologyRequestSchema } from "@proto/mesh_state/v1/mesh_state_pb";
import { DispatchEventRequestSchema } from "@proto/app_state/v1/app_state_pb";
import { ApplyRemoteOpRequestSchema } from "@proto/blockstore_state/v1/blockstore_state_pb";

import {
  ApplySessionRequestSchema,
  SetOrganizationsRequestSchema,
  SetCurrentOrgRequestSchema,
} from "@proto/auth_state/v1/auth_state_pb";
import { UserSchema } from "@proto/auth/v1/auth_pb";
import { OrganizationSchema } from "@proto/org/v1/org_pb";

describe("proto roundtrip — mesh_state.v1", () => {
  it("ReplaceTopologyRequest carries typed MeshTopology proto", () => {
    const req = create(ReplaceTopologyRequestSchema, {
      topology: { nodes: [{ podKey: "pod-1", status: "running" }], edges: [], channels: [], runners: [] },
    });
    const decoded = fromBinary(
      ReplaceTopologyRequestSchema,
      toBinary(ReplaceTopologyRequestSchema, req),
    );
    expect(decoded.topology?.nodes[0]?.podKey).toBe("pod-1");
    expect(decoded.topology?.nodes[0]?.status).toBe("running");
  });
});

describe("proto roundtrip — app_state.v1", () => {
  it("DispatchEventRequest carries opaque event JSON", () => {
    const blob = JSON.stringify({ type: "pod:status_changed", data: { pod_key: "pod-1" } });
    const req = create(DispatchEventRequestSchema, { eventJson: blob });
    const decoded = fromBinary(
      DispatchEventRequestSchema,
      toBinary(DispatchEventRequestSchema, req),
    );
    expect(decoded.eventJson).toBe(blob);
  });
});

describe("proto roundtrip — blockstore_state.v1", () => {
  it("ApplyRemoteOpRequest carries opaque op JSON", () => {
    const blob = JSON.stringify({
      id: 42, workspace_id: "ws-1", kind: "createBlock",
      payload: { type: "para", text: "hi" }, applied_at: "2026-05-27T00:00:00Z",
    });
    const req = create(ApplyRemoteOpRequestSchema, { opJson: blob });
    const decoded = fromBinary(
      ApplyRemoteOpRequestSchema,
      toBinary(ApplyRemoteOpRequestSchema, req),
    );
    expect(decoded.opJson).toBe(blob);
  });
});

describe("proto roundtrip — auth_state.v1", () => {
  function makeUser() {
    return create(UserSchema, {
      id: BigInt(1), email: "u@example.com", username: "u",
    });
  }

  function makeOrg() {
    return create(OrganizationSchema, {
      id: BigInt(10), name: "Acme", slug: "acme",
      subscriptionPlan: "pro", subscriptionStatus: "active",
    });
  }

  it("ApplySessionRequest carries token + refresh_token + user", () => {
    const req = create(ApplySessionRequestSchema, {
      token: "tok-1", refreshToken: "ref-1", user: makeUser(),
    });
    const decoded = fromBinary(
      ApplySessionRequestSchema,
      toBinary(ApplySessionRequestSchema, req),
    );
    expect(decoded.token).toBe("tok-1");
    expect(decoded.refreshToken).toBe("ref-1");
    expect(decoded.user?.id).toBe(BigInt(1));
    expect(decoded.user?.email).toBe("u@example.com");
  });

  it("SetOrganizationsRequest carries items[]", () => {
    const req = create(SetOrganizationsRequestSchema, { items: [makeOrg()] });
    const decoded = fromBinary(
      SetOrganizationsRequestSchema,
      toBinary(SetOrganizationsRequestSchema, req),
    );
    expect(decoded.items).toHaveLength(1);
    expect(decoded.items[0].slug).toBe("acme");
  });

  it("SetCurrentOrgRequest — org present", () => {
    const req = create(SetCurrentOrgRequestSchema, { org: makeOrg() });
    const decoded = fromBinary(
      SetCurrentOrgRequestSchema,
      toBinary(SetCurrentOrgRequestSchema, req),
    );
    expect(decoded.org?.id).toBe(BigInt(10));
  });

  it("SetCurrentOrgRequest — org absent (clear)", () => {
    const req = create(SetCurrentOrgRequestSchema, {});
    const decoded = fromBinary(
      SetCurrentOrgRequestSchema,
      toBinary(SetCurrentOrgRequestSchema, req),
    );
    expect(decoded.org).toBeUndefined();
  });
});
