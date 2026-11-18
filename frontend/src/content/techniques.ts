export const CMS_TECHNIQUES = [
  {
    id: "evoguard",
    label: "Agent-ToM",
    description: "A theory-of-mind monitor for suspicious agent behavior.",
    availableInDemo: true,
  },
] as const;

export type CmsTechniqueId = (typeof CMS_TECHNIQUES)[number]["id"];
