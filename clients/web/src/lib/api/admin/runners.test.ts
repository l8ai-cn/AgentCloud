import { beforeEach, describe, expect, it, vi } from "vitest";

const callAdminConnect = vi.fn();

vi.mock("./transport", () => ({
  callAdminConnect: (...args: unknown[]) => callAdminConnect(...args),
}));

import {
  deleteRunner,
  disableRunner,
  enableRunner,
  listRunners,
} from "./runners";

function protoRunner(id: number, hostInfoJson?: string) {
  return {
    id: BigInt(id),
    organizationId: 3n,
    nodeId: "runner-node-1",
    description: undefined,
    status: "online",
    isEnabled: true,
    runnerVersion: "1.2.3",
    currentPods: 2,
    maxConcurrentPods: 10,
    availableAgents: ["codex"],
    hostInfoJson,
    lastHeartbeat: undefined,
    createdAt: "2026-07-30T00:00:00Z",
    updatedAt: "2026-07-30T00:00:00Z",
    organization: { id: 3n, name: "Acme", slug: "acme" },
  };
}

describe("admin runners API", () => {
  beforeEach(() => callAdminConnect.mockReset());

  it("maps list pagination and runner fields", async () => {
    callAdminConnect.mockResolvedValue({
      items: [protoRunner(7, '{"os":"linux"}')],
      total: 1n,
      page: 2,
      pageSize: 20,
      totalPages: 3,
    });

    const result = await listRunners({ search: "node", org_id: 3, page: 2, page_size: 20 });

    expect(callAdminConnect).toHaveBeenCalledWith(
      "proto.admin.v1.AdminService",
      "ListRunners",
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ search: "node", orgId: 3n, page: 2, pageSize: 20 }),
    );
    expect(result).toMatchObject({
      total: 1,
      page: 2,
      page_size: 20,
      total_pages: 3,
      data: [
        {
          id: 7,
          organization_id: 3,
          node_id: "runner-node-1",
          host_info: { os: "linux" },
          organization: { id: 3, name: "Acme", slug: "acme" },
        },
      ],
    });
  });

  it("maps invalid or absent host_info_json to null", async () => {
    callAdminConnect.mockResolvedValue({
      items: [protoRunner(1, "{not-json"), protoRunner(2)],
      total: 2n,
      page: 1,
      pageSize: 20,
      totalPages: 1,
    });

    const result = await listRunners();

    expect(result.data[0].host_info).toBeNull();
    expect(result.data[1].host_info).toBeNull();
  });

  it.each([
    ["DisableRunner", disableRunner],
    ["EnableRunner", enableRunner],
  ])("calls %s with a bigint runner id", async (method, action) => {
    callAdminConnect.mockResolvedValue(protoRunner(42));

    await action(42);

    expect(callAdminConnect).toHaveBeenCalledWith(
      "proto.admin.v1.AdminService",
      method,
      expect.anything(),
      expect.anything(),
      { runnerId: 42n },
    );
  });

  it("returns the delete confirmation message", async () => {
    callAdminConnect.mockResolvedValue({ message: "Runner deleted" });

    const result = await deleteRunner(42);

    expect(callAdminConnect).toHaveBeenCalledWith(
      "proto.admin.v1.AdminService",
      "DeleteRunner",
      expect.anything(),
      expect.anything(),
      { runnerId: 42n },
    );
    expect(result).toEqual({ message: "Runner deleted" });
  });
});
