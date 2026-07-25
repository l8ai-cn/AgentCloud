export function buildReconnectCommand(input: {
  sessionId: string;
  serverUrl: string;
  wrapper: string | null;
}): string {
  const lines = [
    "runner run \\",
    `  # resume session ${input.sessionId}`,
    `  # server: ${input.serverUrl}`,
  ];
  if (input.wrapper !== "claude-code-native-ui") {
    lines.push("  # or re-open the session from Agent Cloud web UI");
  }
  return lines.join("\n");
}
