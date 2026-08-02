import type {
  AgentCommand,
  AgentSessionRuntime,
  AgentSessionSnapshot,
} from "@agent-cloud/agent-ui";

export interface LoopalSlashRuntimeOptions {
  getCommands: () => AgentCommand[];
  dispatch: (name: string, argument: string) => void;
}

function sameCommands(a: AgentCommand[], b: AgentCommand[]): boolean {
  return (
    a.length === b.length &&
    a.every((command, index) => command.name === b[index].name)
  );
}

/**
 * Publishes loopal's control verbs as workbench slash commands and routes them
 * to the relay control channel, which has no equivalent in the session API.
 *
 * getSnapshot must stay referentially stable while nothing changed — the
 * workbench reads it through useSyncExternalStore, so a fresh object per call
 * would re-render forever. Both the base snapshot and the command list are
 * therefore memoized, and an unstable-but-equal command array is normalized
 * back to the cached reference.
 */
export function createLoopalSlashRuntime(
  base: AgentSessionRuntime,
  options: LoopalSlashRuntimeOptions,
): AgentSessionRuntime {
  let commandCache: AgentCommand[] = [];
  let snapshotCache: { source: AgentSessionSnapshot; merged: AgentSessionSnapshot } | null =
    null;

  const runtime: AgentSessionRuntime = {
    open: (sessionId) => base.open(sessionId),
    close: (sessionId) => base.close(sessionId),
    getSnapshot: (sessionId) => {
      const source = base.getSnapshot(sessionId);
      const next = options.getCommands();
      if (!sameCommands(commandCache, next)) commandCache = next;
      if (
        snapshotCache?.source === source &&
        snapshotCache.merged.commands === commandCache
      ) {
        return snapshotCache.merged;
      }
      const merged = { ...source, commands: commandCache };
      snapshotCache = { source, merged };
      return merged;
    },
    subscribe: (sessionId, listener) => base.subscribe(sessionId, listener),
    sendMessage: (sessionId, commandId, input) =>
      base.sendMessage(sessionId, commandId, input),
    sendSlashCommand: async (_sessionId, _commandId, input) => {
      options.dispatch(input.name, input.arguments);
    },
    interrupt: (sessionId, commandId) => base.interrupt(sessionId, commandId),
    resolvePermission: (sessionId, commandId, permissionId, result) =>
      base.resolvePermission(sessionId, commandId, permissionId, result),
    updateConfiguration: (sessionId, commandId, patch) =>
      base.updateConfiguration(sessionId, commandId, patch),
    loadOlder: (sessionId, beforeItemId) =>
      base.loadOlder(sessionId, beforeItemId),
  };

  if (base.create) runtime.create = (input) => base.create!(input);
  if (base.uploadAttachment) {
    runtime.uploadAttachment = (sessionId, file) =>
      base.uploadAttachment!(sessionId, file);
  }
  if (base.loadArtifact) {
    runtime.loadArtifact = (sessionId, artifactId, representationId) =>
      base.loadArtifact!(sessionId, artifactId, representationId);
  }
  if (base.executeArtifactAction) {
    runtime.executeArtifactAction = (sessionId, command) =>
      base.executeArtifactAction!(sessionId, command);
  }
  return runtime;
}
