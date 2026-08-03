import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PodData } from "@/lib/api/facade/pod";

import { WorkerSkillMounts } from "../WorkerSkillMounts";

const updatePodSkills = vi.fn();
const fetchPod = vi.fn();

vi.mock("@/lib/api/facade/podConnect", () => ({
  updatePodSkills: (...args: unknown[]) => updatePodSkills(...args),
}));

vi.mock("@/stores/pod", () => ({
  usePodStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({ fetchPod }),
}));

vi.mock("@/components/pod/hooks/useWorkerSkills", () => ({
  useWorkerSkills: () => ({
    skills: [
      { id: 1, slug: "pdf-tools", scope: "org" as const },
      { id: 2, slug: "lint-guard", scope: "org" as const },
    ],
    loading: false,
    error: null,
  }),
}));

const t = (key: string, params?: Record<string, string | number>) =>
  params
    ? Object.entries(params).reduce(
        (text, [name, value]) => text.replace(`{${name}}`, String(value)),
        key,
      )
    : key;

function podWith(overrides: Partial<PodData> = {}): PodData {
  return {
    id: 1,
    pod_key: "pod-1",
    status: "running",
    created_at: "2026-08-01T00:00:00Z",
    worker_spec_snapshot_id: 100,
    worker_skill_slugs: ["pdf-tools"],
    ...overrides,
  } as PodData;
}

function renderMounts(pod: PodData) {
  return render(<WorkerSkillMounts pod={pod} orgSlug="acme" t={t} />);
}

describe("WorkerSkillMounts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updatePodSkills.mockResolvedValue({
      mounted_slugs: ["pdf-tools", "lint-guard"],
      added_slugs: ["lint-guard"],
      removed_slugs: [],
      applied_to_runner: true,
    });
  });

  it("lists the currently mounted skills", () => {
    renderMounts(podWith());
    expect(screen.getByText("pdf-tools")).toBeInTheDocument();
  });

  // Skills are pinned onto a spec snapshot, so a worker without one has nothing
  // the remount RPC can rewrite.
  it("hides the edit affordance when the worker has no spec snapshot", () => {
    renderMounts(podWith({ worker_spec_snapshot_id: undefined }));
    expect(
      screen.queryByRole("button", { name: "ide.bottomPanel.workerSettings.edit" }),
    ).not.toBeInTheDocument();
  });

  it("sends catalog ids for the new selection and refreshes the pod", async () => {
    const user = userEvent.setup();
    renderMounts(podWith());

    await user.click(
      screen.getByRole("button", { name: "ide.bottomPanel.workerSettings.edit" }),
    );
    await user.click(screen.getByRole("checkbox", { name: /lint-guard/ }));
    await user.click(
      screen.getByRole("button", { name: "ide.bottomPanel.workerSettings.save" }),
    );

    await waitFor(() => expect(updatePodSkills).toHaveBeenCalledWith("acme", "pod-1", [1, 2]));
    expect(fetchPod).toHaveBeenCalledWith("pod-1");
  });

  it("keeps save disabled until the selection changes", async () => {
    const user = userEvent.setup();
    renderMounts(podWith());

    await user.click(
      screen.getByRole("button", { name: "ide.bottomPanel.workerSettings.edit" }),
    );
    const save = screen.getByRole("button", {
      name: "ide.bottomPanel.workerSettings.save",
    });
    expect(save).toBeDisabled();

    await user.click(screen.getByRole("checkbox", { name: /lint-guard/ }));
    expect(save).toBeEnabled();
  });

  it("surfaces the failure and leaves the dialog open", async () => {
    const user = userEvent.setup();
    updatePodSkills.mockRejectedValue(new Error("skill 2 is not accessible"));
    renderMounts(podWith());

    await user.click(
      screen.getByRole("button", { name: "ide.bottomPanel.workerSettings.edit" }),
    );
    await user.click(screen.getByRole("checkbox", { name: /lint-guard/ }));
    await user.click(
      screen.getByRole("button", { name: "ide.bottomPanel.workerSettings.save" }),
    );

    expect(await screen.findByText("skill 2 is not accessible")).toBeInTheDocument();
    expect(fetchPod).not.toHaveBeenCalled();
  });

  // A stopped worker still records the change, so the user must be told the
  // files only land on the next start.
  it("explains that a stopped worker applies the change on its next start", async () => {
    const user = userEvent.setup();
    updatePodSkills.mockResolvedValue({
      mounted_slugs: ["pdf-tools", "lint-guard"],
      added_slugs: ["lint-guard"],
      removed_slugs: [],
      applied_to_runner: false,
    });
    renderMounts(podWith({ status: "stopped" }));

    await user.click(
      screen.getByRole("button", { name: "ide.bottomPanel.workerSettings.edit" }),
    );
    await user.click(screen.getByRole("checkbox", { name: /lint-guard/ }));
    await user.click(
      screen.getByRole("button", { name: "ide.bottomPanel.workerSettings.save" }),
    );

    await waitFor(() => expect(updatePodSkills).toHaveBeenCalled());
    expect(
      screen.getByText("ide.bottomPanel.workerSettings.appliesOnNextStart"),
    ).toBeInTheDocument();
  });
});
