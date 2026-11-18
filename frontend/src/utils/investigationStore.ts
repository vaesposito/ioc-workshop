export type Severity = "low" | "medium" | "high" | "critical";

export interface AttackResult {
  id: string;
  type: string;
  description: string;
  step?: number | string;
  anomalies?: string[];
  excerpt?: string;
  relevance?: string | number;
  pattern?: string;
  where?: string;
  reasoning?: string;
  confidence?: number;
  benign?: 0 | 1;
  severity: Severity;
}

export interface ToolCall {
  name: string;
  arguments: Record<string, unknown>;
  result?: string;
  host_contacted?: string;
}

export interface ConversationTurn {
  role: "user" | "assistant" | "system";
  content: string;
  tool_calls?: ToolCall[];
}

export interface MemoryAnnotation {
  attack_label: 0 | 1;
  derailment_label: 0 | 1;
  misbehaviour_explanation: string[];
  domain?: string;
  misbehaviour_type?: string;
}

export interface InvestigationMemory {
  raw_conversation_payload: ConversationTurn[];
  annotation: MemoryAnnotation;
}

export interface InvestigationExecutionMetadata {
  requested_technique?: string;
  effective_technique?: string;
  forced_baseline?: boolean;
  requested_memory_ready?: boolean;
}

export interface Investigation {
  id: string;
  trace_id: string;
  traceFileId?: string;
  applicationId: string;
  name: string;
  technique: string;
  effectiveTechnique?: string;
  executionMetadata?: InvestigationExecutionMetadata;
  description?: string;
  modelReasoning?: string;
  results: AttackResult[];
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  status?: "completed" | "pending" | "started" | "failed";
  error?: string;
  memory?: InvestigationMemory;
  memoryReadiness?: boolean;
  readinessScore?: number | null;
  confidence?: number | null;
  model?: string;
  durationSeconds?: number;
  cost?: number | string;
  token?: number;
  verdict: "malicious" | "benign" | "error";
}
