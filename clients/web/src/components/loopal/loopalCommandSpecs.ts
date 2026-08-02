import type { AgentCommand } from "@agent-cloud/agent-ui";

import { THINKING_OPTIONS } from "./loopalThinking";

export interface LoopalControlCall {
  subtype: string;
  payload?: Record<string, unknown>;
}

export interface LoopalCommandSpec {
  name: string;
  description: string;
  requiresArgument?: boolean;
  resolve: (argument: string) => LoopalControlCall | null;
}

const plain = (subtype: string, payload?: Record<string, unknown>) => () => ({
  subtype,
  payload,
});

// Mirrors loopal TUI's builtin slash commands. Goal sub-commands only surface
// once a goal exists, matching loopal's multi-state /goal.
export function buildLoopalCommandSpecs({
  hasGoal,
  t,
}: {
  hasGoal: boolean;
  t: (key: string) => string;
}): LoopalCommandSpec[] {
  const specs: LoopalCommandSpec[] = [
    { name: "act", description: t("commands.act"), resolve: plain("loopal.mode", { mode: "act" }) },
    { name: "plan", description: t("commands.plan"), resolve: plain("loopal.mode", { mode: "plan" }) },
    {
      name: "thinking",
      description: t("commands.thinking"),
      requiresArgument: true,
      resolve: (argument) => {
        const option = THINKING_OPTIONS.find(
          (candidate) => candidate.key === argument.trim().toLowerCase(),
        );
        return option ? { subtype: "loopal.thinking", payload: { config: option.config } } : null;
      },
    },
    { name: "compact", description: t("commands.compact"), resolve: plain("loopal.compact") },
    { name: "clear", description: t("commands.clear"), resolve: plain("loopal.clear") },
    {
      name: "rewind",
      description: t("commands.rewind"),
      requiresArgument: true,
      resolve: (argument) => {
        const turn = Number(argument.trim());
        return Number.isInteger(turn) && turn >= 0
          ? { subtype: "loopal.rewind", payload: { turn_index: turn } }
          : null;
      },
    },
    {
      name: "resume",
      description: t("commands.resume"),
      requiresArgument: true,
      resolve: (argument) => {
        const sessionId = argument.trim();
        return sessionId
          ? { subtype: "loopal.resumeSession", payload: { session_id: sessionId } }
          : null;
      },
    },
    { name: "suspend", description: t("commands.suspend"), resolve: plain("loopal.suspend") },
    { name: "unsuspend", description: t("commands.unsuspend"), resolve: plain("loopal.unsuspend") },
    {
      name: "goal",
      description: t("commands.goal"),
      requiresArgument: true,
      resolve: (argument) => {
        const objective = argument.trim();
        return objective
          ? { subtype: "loopal.goalCreate", payload: { objective } }
          : null;
      },
    },
    { name: "mcp-refresh", description: t("commands.mcpRefresh"), resolve: plain("loopal.mcpStatus") },
  ];

  if (hasGoal) {
    specs.push(
      { name: "goal-pause", description: t("commands.goalPause"), resolve: plain("loopal.goalPause") },
      { name: "goal-resume", description: t("commands.goalResume"), resolve: plain("loopal.goalResume") },
      { name: "goal-complete", description: t("commands.goalComplete"), resolve: plain("loopal.goalComplete") },
      { name: "goal-reopen", description: t("commands.goalReopen"), resolve: plain("loopal.goalReopen") },
      { name: "goal-clear", description: t("commands.goalClear"), resolve: plain("loopal.goalClear") },
    );
  }
  return specs;
}

export function toAgentCommands(specs: LoopalCommandSpec[]): AgentCommand[] {
  return specs.map((spec) => ({
    name: spec.name,
    label: `/${spec.name}`,
    description: spec.description,
    requiresArgument: spec.requiresArgument,
  }));
}

export function resolveLoopalCommand(
  specs: LoopalCommandSpec[],
  name: string,
  argument: string,
): LoopalControlCall | null {
  const spec = specs.find(
    (candidate) => candidate.name === name.replace(/^\//, "").toLowerCase(),
  );
  return spec ? spec.resolve(argument) : null;
}
