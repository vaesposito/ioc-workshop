export type InvestigationStatus = "idle" | "running";

export interface Application {
  id: string;
  name: string;
  description: string;
  createdAt: number;
  investigationStatus: InvestigationStatus;
  memoryReadinessByTechnique: {
    evoguard: number;
  };
}
