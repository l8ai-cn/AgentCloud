import { describe, it, expect } from "vitest";
import {
  buildLoopalCommandSpecs,
  resolveLoopalCommand,
  toAgentCommands,
} from "../loopalCommandSpecs";
import { thinkingKey, THINKING_OPTIONS } from "../loopalThinking";

const t = (k: string) => k;
const specs = (hasGoal = false) => buildLoopalCommandSpecs({ hasGoal, t });

describe("loopal command specs", () => {
  it("hides goal sub-commands until a goal exists", () => {
    const names = specs().map((spec) => spec.name);
    expect(names).not.toContain("goal-pause");
    expect(specs(true).map((spec) => spec.name)).toContain("goal-pause");
  });

  it("publishes commands in the workbench slash format", () => {
    const commands = toAgentCommands(specs());
    const goal = commands.find((command) => command.name === "goal");
    expect(goal).toMatchObject({ label: "/goal", requiresArgument: true });
    const act = commands.find((command) => command.name === "act");
    expect(act).toMatchObject({ label: "/act" });
    expect(act?.requiresArgument).toBeUndefined();
  });

  it("routes plain verbs to their relay control subtype", () => {
    expect(resolveLoopalCommand(specs(), "act", "")).toEqual({
      subtype: "loopal.mode",
      payload: { mode: "act" },
    });
    expect(resolveLoopalCommand(specs(), "compact", "")).toEqual({
      subtype: "loopal.compact",
      payload: undefined,
    });
  });

  it("accepts a leading slash and mixed case", () => {
    expect(resolveLoopalCommand(specs(), "/PLAN", "")).toEqual({
      subtype: "loopal.mode",
      payload: { mode: "plan" },
    });
  });

  it("carries the goal objective as the command argument", () => {
    expect(resolveLoopalCommand(specs(), "goal", "  ship the release  ")).toEqual({
      subtype: "loopal.goalCreate",
      payload: { objective: "ship the release" },
    });
  });

  it("rejects an argument-less command that needs one", () => {
    expect(resolveLoopalCommand(specs(), "goal", "   ")).toBeNull();
    expect(resolveLoopalCommand(specs(), "resume", "")).toBeNull();
  });

  it("maps a thinking level to its wire config", () => {
    const call = resolveLoopalCommand(specs(), "thinking", "high");
    expect(call?.subtype).toBe("loopal.thinking");
    expect(thinkingKey(call?.payload?.config as string)).toBe("high");
  });

  it("rejects an unknown thinking level", () => {
    expect(resolveLoopalCommand(specs(), "thinking", "turbo")).toBeNull();
  });

  it("parses a rewind turn index and rejects non-integers", () => {
    expect(resolveLoopalCommand(specs(), "rewind", "3")).toEqual({
      subtype: "loopal.rewind",
      payload: { turn_index: 3 },
    });
    expect(resolveLoopalCommand(specs(), "rewind", "-1")).toBeNull();
    expect(resolveLoopalCommand(specs(), "rewind", "abc")).toBeNull();
  });

  it("returns null for an unknown command", () => {
    expect(resolveLoopalCommand(specs(), "nope", "")).toBeNull();
  });
});

describe("thinkingKey", () => {
  it("round-trips every offered option", () => {
    for (const option of THINKING_OPTIONS) {
      expect(thinkingKey(option.config)).toBe(option.key);
    }
  });

  it("returns null for absent or malformed config", () => {
    expect(thinkingKey(null)).toBeNull();
    expect(thinkingKey("{oops")).toBeNull();
  });
});
