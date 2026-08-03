import {
  Code,
  FileDiff,
  FilePenLine,
  FilePlus2,
  FileText,
  Globe,
  Image,
  ListChecks,
  MessageCircleQuestion,
  MousePointerClick,
  PackageCheck,
  Plug,
  Search,
  Terminal,
  type LucideIcon,
} from "lucide-react";

import type { AgentToolRendererRegistration } from "./react/rendererTypes";
import { ToolRendererRegistry } from "./registry/ToolRendererRegistry";

interface ToolPresentation {
  icon: LucideIcon;
  label: string;
  inputLabel?: string;
  outputLabel?: string;
}

// Semantic keys mirror runner/internal/workbench/source_tool_catalog.go. Labels
// resolve through toolLocalization, so they stay English here.
const presentations: Record<string, ToolPresentation> = {
  "artifact.publish": { icon: PackageCheck, label: "Publish artifact" },
  "code.interpret": {
    icon: Code,
    inputLabel: "Code",
    label: "Run code",
    outputLabel: "Output",
  },
  "computer.use": {
    icon: MousePointerClick,
    inputLabel: "Action",
    label: "Computer use",
    outputLabel: "Result",
  },
  "filesystem.change": {
    icon: FileDiff,
    inputLabel: "Path",
    label: "File change",
    outputLabel: "Change",
  },
  "filesystem.edit": {
    icon: FilePenLine,
    inputLabel: "Path",
    label: "File change",
    outputLabel: "Change",
  },
  "filesystem.read": {
    icon: FileText,
    inputLabel: "Path",
    label: "Read file",
    outputLabel: "Content",
  },
  "filesystem.search": {
    icon: Search,
    inputLabel: "Query",
    label: "Search",
    outputLabel: "Matches",
  },
  "filesystem.write": {
    icon: FilePlus2,
    inputLabel: "Path",
    label: "Write file",
    outputLabel: "Result",
  },
  "interaction.question": {
    icon: MessageCircleQuestion,
    inputLabel: "Prompt",
    label: "Ask user",
    outputLabel: "Result",
  },
  "mcp.call": {
    icon: Plug,
    inputLabel: "Request",
    label: "MCP call",
    outputLabel: "Result",
  },
  "mcp.list-tools": { icon: Plug, label: "MCP tools" },
  "media.image.generate": {
    icon: Image,
    inputLabel: "Prompt",
    label: "Image generation",
    outputLabel: "Result",
  },
  "plan.todo": { icon: ListChecks, label: "Plan" },
  "shell.execute": {
    icon: Terminal,
    inputLabel: "Command",
    label: "Shell",
    outputLabel: "Output",
  },
  "web.fetch": {
    icon: Globe,
    inputLabel: "Request",
    label: "Fetch page",
    outputLabel: "Content",
  },
  "web.search": {
    icon: Globe,
    inputLabel: "Query",
    label: "Web search",
    outputLabel: "Matches",
  },
};

// The producing protocol is part of the identity, but a canonical semantic key
// renders the same whichever agent emitted it. tool.custom is deliberately
// absent so unknown tools keep falling back to raw evidence.
const namespaces = [
  "agentcloud.acp",
  "agentcloud.claude",
  "agentcloud.codex",
  "agentcloud.runner",
];

export function createBuiltinToolRenderers() {
  const registry = new ToolRendererRegistry<AgentToolRendererRegistration>();
  for (const [semanticKey, presentation] of Object.entries(presentations)) {
    for (const namespace of namespaces) {
      registry.register(
        { namespace, schemaVersion: "1", semanticKey },
        { presentation },
        `builtin.${semanticKey}`,
      );
    }
  }
  return registry;
}
