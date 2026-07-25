import { parseAgentCommand } from "../../ComposerCommandMenu";
import type {
  AgentAttachmentReference,
  AgentSessionRuntime,
  AgentSessionSnapshot,
} from "../../contracts";
import type { MentionItem } from "./mentionSerialize";

export async function submitComposerMessage(options: {
  message: string;
  attachments: AgentAttachmentReference[];
  mentioned: readonly MentionItem[];
  outboundText: string;
  runtime: AgentSessionRuntime;
  snapshot: AgentSessionSnapshot;
  requiresArgument: (label: string) => string;
  slashAttachmentsUnsupported: string;
}): Promise<"sent" | "blocked"> {
  const {
    message,
    attachments,
    mentioned,
    outboundText,
    runtime,
    snapshot,
  } = options;
  if (
    (!message && attachments.length === 0 && mentioned.length === 0) ||
    !snapshot.capabilities.sendMessage
  ) {
    return "blocked";
  }
  const parsedCommand = parseAgentCommand(message, snapshot.commands ?? []);
  if (parsedCommand?.command.requiresArgument && !parsedCommand.arguments) {
    throw new Error(options.requiresArgument(parsedCommand.command.label));
  }
  if (parsedCommand && (attachments.length > 0 || mentioned.length > 0)) {
    throw new Error(options.slashAttachmentsUnsupported);
  }
  if (parsedCommand && runtime.sendSlashCommand) {
    await runtime.sendSlashCommand(snapshot.sessionId, crypto.randomUUID(), {
      name: parsedCommand.command.name,
      arguments: parsedCommand.arguments,
    });
    return "sent";
  }
  await runtime.sendMessage(snapshot.sessionId, crypto.randomUUID(), {
    text: outboundText,
    ...(attachments.length > 0 ? { attachments } : {}),
  });
  return "sent";
}
