export const TECHNIQUES = [
  { id: "baseline-detector", label: "Baseline" },
  { id: "agent-auditor", label: "Agent Auditor" },
  { id: "evoguard", label: "Agent-ToM" },
] as const;

export type TechniqueId = (typeof TECHNIQUES)[number]["id"];

export const DEMO_AVAILABLE_TECHNIQUE_ID: TechniqueId = "evoguard";
export const DEFAULT_TECHNIQUE_ID: TechniqueId = DEMO_AVAILABLE_TECHNIQUE_ID;

export function isTechniqueAvailableInDemo(id: TechniqueId): boolean {
  return id === DEMO_AVAILABLE_TECHNIQUE_ID;
}

const TECHNIQUE_LABELS: Record<TechniqueId, string> = {
  "baseline-detector": "Baseline",
  "agent-auditor": "Agent Auditor",
  evoguard: "Agent-ToM",
};

export function isTechniqueId(value: string): value is TechniqueId {
  return TECHNIQUES.some((technique) => technique.id === value);
}

export function normalizeTechniqueId(
  value: string | null | undefined,
): TechniqueId {
  if (value && isTechniqueId(value)) {
    return value;
  }
  return DEFAULT_TECHNIQUE_ID;
}

export function getTechniqueLabel(_value: string): string {
  return TECHNIQUE_LABELS[DEMO_AVAILABLE_TECHNIQUE_ID];
}

export function getDisplayTechnique(
  requestedTechnique: string,
  effectiveTechnique?: string,
): string {
  const normalizedEffective = effectiveTechnique?.trim();
  const source =
    normalizedEffective && normalizedEffective.length > 0
      ? normalizedEffective
      : requestedTechnique;
  return getTechniqueLabel(source);
}
