export type NativeCodingAgentKey = "claude" | "codex" | "cursor" | "pi" | string;

export interface NativeCodingAgentRef {
  key: NativeCodingAgentKey;
}

const BY_HARNESS = new Map<string, NativeCodingAgentRef>([
  ["claude-native", { key: "claude" }],
  ["codex-native", { key: "codex" }],
  ["codex", { key: "codex" }],
  ["cursor-native", { key: "cursor" }],
  ["pi-native", { key: "pi" }],
  ["opencode-native", { key: "opencode" }],
  ["kiro-native", { key: "kiro" }],
  ["antigravity-native", { key: "antigravity" }],
  ["goose-native", { key: "goose" }],
  ["qwen-native", { key: "qwen" }],
  ["kimi-native", { key: "kimi" }],
  ["hermes-native", { key: "hermes" }],
]);

const HARNESS_ALIASES: Record<string, string> = {
  "native-pi": "pi-native",
  "native-cursor": "cursor-native",
  "native-kiro": "kiro-native",
  "native-antigravity": "antigravity-native",
  "native-goose": "goose-native",
  "native-qwen": "qwen-native",
  "native-kimi": "kimi-native",
  "native-hermes": "hermes-native",
  "native-codex": "codex-native",
  "native-opencode": "opencode-native",
};

export function nativeCodingAgentForHarness(
  harness: string | null | undefined,
): NativeCodingAgentRef | undefined {
  if (harness == null) return undefined;
  return BY_HARNESS.get(HARNESS_ALIASES[harness] ?? harness);
}
