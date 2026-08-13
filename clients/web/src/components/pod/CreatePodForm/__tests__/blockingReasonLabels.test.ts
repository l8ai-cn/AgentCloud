import { describe, expect, it } from "vitest";

import { localizeModelBlockingReason } from "../modelBlockingReasonLabels";
import {
  blockingReasonKind,
  localizeWorkerBlockingReasons,
} from "../workerBlockingReasonLabels";

const t = (key: string) => key;

describe("blocking reason classification", () => {
  it("separates authorization blocks from capacity and configuration blocks", () => {
    expect(blockingReasonKind("not-entitled")).toBe("authorization");
    expect(blockingReasonKind("not-granted")).toBe("authorization");
    expect(blockingReasonKind("no-online-runner")).toBe("other");
    expect(blockingReasonKind("")).toBe("other");
  });

  it("carries the kind alongside the localized worker reason", () => {
    const [entitled, offline] = localizeWorkerBlockingReasons(
      [{ blockingReason: "not-entitled" }, { blockingReason: "no-online-runner" }],
      t,
    );
    expect(entitled).toEqual({
      blockingKind: "authorization",
      blockingReason: "runtime.options.notEntitled",
    });
    expect(offline.blockingKind).toBe("other");
  });

  it("localizes model reasons and flags the grant denial", () => {
    expect(localizeModelBlockingReason("not-granted", t)).toEqual({
      blockingKind: "authorization",
      blockingReason: "workerCreate.runtime.options.modelNotGranted",
    });
    expect(localizeModelBlockingReason("connection-invalid", t)).toEqual({
      blockingKind: "other",
      blockingReason: "workerCreate.runtime.options.modelConnectionInvalid",
    });
  });

  it("passes an unknown code through so draft-validation text still renders", () => {
    expect(localizeModelBlockingReason("free-form text", t).blockingReason).toBe(
      "free-form text",
    );
  });
});
