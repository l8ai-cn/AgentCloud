export const ALL_SCOPES = [
  "pods:read",
  "pods:write",
  "tickets:read",
  "tickets:write",
  "channels:read",
  "channels:write",
  "runners:read",
  "repos:read",
  "workflows:read",
  "workflows:write",
  "experts:read",
  "experts:write",
];

export const SCOPE_GROUPS = [
  {
    groupKey: "settings.apiKeys.scopeGroupPods",
    scopes: ["pods:read", "pods:write"],
  },
  {
    groupKey: "settings.apiKeys.scopeGroupTickets",
    scopes: ["tickets:read", "tickets:write"],
  },
  {
    groupKey: "settings.apiKeys.scopeGroupChannels",
    scopes: ["channels:read", "channels:write"],
  },
  {
    groupKey: "settings.apiKeys.scopeGroupRunners",
    scopes: ["runners:read"],
  },
  {
    groupKey: "settings.apiKeys.scopeGroupRepositories",
    scopes: ["repos:read"],
  },
  {
    groupKey: "settings.apiKeys.scopeGroupLoops",
    scopes: ["workflows:read", "workflows:write"],
  },
  {
    groupKey: "settings.apiKeys.scopeGroupExperts",
    scopes: ["experts:read", "experts:write"],
  },
];

export const SCOPE_LABEL_KEYS: Record<string, string> = {
  "pods:read": "settings.apiKeys.createDialog.scopePodsRead",
  "pods:write": "settings.apiKeys.createDialog.scopePodsWrite",
  "tickets:read": "settings.apiKeys.createDialog.scopeTicketsRead",
  "tickets:write": "settings.apiKeys.createDialog.scopeTicketsWrite",
  "channels:read": "settings.apiKeys.createDialog.scopeChannelsRead",
  "channels:write": "settings.apiKeys.createDialog.scopeChannelsWrite",
  "runners:read": "settings.apiKeys.createDialog.scopeRunnersRead",
  "repos:read": "settings.apiKeys.createDialog.scopeReposRead",
  "workflows:read": "settings.apiKeys.createDialog.scopeLoopsRead",
  "workflows:write": "settings.apiKeys.createDialog.scopeLoopsWrite",
  "experts:read": "settings.apiKeys.createDialog.scopeExpertsRead",
  "experts:write": "settings.apiKeys.createDialog.scopeExpertsWrite",
};

export const SCOPE_DESCRIPTION_KEYS: Record<string, string> = {
  "pods:read": "settings.apiKeys.createDialog.scopePodsReadDesc",
  "pods:write": "settings.apiKeys.createDialog.scopePodsWriteDesc",
  "tickets:read": "settings.apiKeys.createDialog.scopeTicketsReadDesc",
  "tickets:write": "settings.apiKeys.createDialog.scopeTicketsWriteDesc",
  "channels:read": "settings.apiKeys.createDialog.scopeChannelsReadDesc",
  "channels:write": "settings.apiKeys.createDialog.scopeChannelsWriteDesc",
  "runners:read": "settings.apiKeys.createDialog.scopeRunnersReadDesc",
  "repos:read": "settings.apiKeys.createDialog.scopeReposReadDesc",
  "workflows:read": "settings.apiKeys.createDialog.scopeLoopsReadDesc",
  "workflows:write": "settings.apiKeys.createDialog.scopeLoopsWriteDesc",
  "experts:read": "settings.apiKeys.createDialog.scopeExpertsReadDesc",
  "experts:write": "settings.apiKeys.createDialog.scopeExpertsWriteDesc",
};
