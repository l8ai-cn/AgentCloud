import type { Expert } from "@/lib/api/expertApi";

export function isResourceManagedExpert(expert: Expert): boolean {
  return expert.orchestration_resource_id != null ||
    expert.orchestration_resource_revision != null;
}

export function expertCategory(expert: Expert): string | null {
  const raw = isResourceManagedExpert(expert)
    ? expert.metadata?.category
    : expert.metadata?.expertType;
  return typeof raw === "string" && raw.trim() ? raw.trim() : null;
}

export function expertOriginKey(expert: Expert): string {
  if (expert.source_market_application_id != null) return "marketOrigin";
  if (isResourceManagedExpert(expert)) return "resourceOrigin";
  return "organizationOrigin";
}

export function expertAutomationKey(expert: Expert): string {
  return expertAutomationLabelKey(expert.automation_level);
}

export function expertAutomationLabelKey(level: string): string {
  switch (level) {
    case "interactive":
      return "automationInteractive";
    case "auto_edit":
      return "automationAutoEdit";
    case "autonomous":
      return "automationAutonomous";
    default:
      return "automationUnknown";
  }
}

export function expertAutomationValue(level: string): string {
  switch (level) {
    case "interactive":
    case "auto_edit":
    case "autonomous":
      return level;
    default:
      return "unknown";
  }
}
