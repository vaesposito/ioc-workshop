export interface AgentTomPage {
  id: string;
  step: string;
  kicker: string;
  title: string;
  body: string;
  points?: string[];
  pipeline?: { name: string; detail: string }[];
}

export const AGENT_TOM_PAPER_URL = "https://arxiv.org/abs/2605.24216";

// Points at the paper until the Outshift post is published.
export const AGENT_TOM_BLOG_URL = AGENT_TOM_PAPER_URL;

export const AGENT_TOM_PAGES: AgentTomPage[] = [
  {
    id: "what",
    step: "What it is",
    kicker: "Meet Agent-ToM",
    title: "A theory-of-mind monitor for your agents",
    body: "Agent-ToM reads the traces your agentic application produces and answers one operational question: is this run malicious or benign? It reasons about what the agent was trying to do, not just which tools it happened to call.",
  },
  {
    id: "learns",
    step: "Learns your app",
    kicker: "Per-app memory",
    title: "It learns what normal looks like",
    body: "A strong baseline labels every trace first. Agent-ToM trains on those labels to build a per-application playbook: a memory of the app's expected behavior, trusted data sources, and safe tool use. Routine work then becomes easy to tell apart from abuse.",
  },
  {
    id: "reasons",
    step: "How it reasons",
    kicker: "Structured reasoning",
    title: "Evidence, not guesswork",
    body: "For every trace Agent-ToM follows the same repeatable chain and cites what it found, so each verdict is explainable rather than a black-box score.",
  },
  {
    id: "pipeline",
    step: "Reasoning pipeline",
    kicker: "Five-step reasoning",
    title: "One repeatable chain, every trace",
    body: "Every verdict follows the same explainable pipeline, so you can trace exactly how Agent-ToM reached benign or malicious.",
    pipeline: [
      {
        name: "Baseline Learning",
        detail:
          "Establishes a normative behavioral baseline of what legitimate, task-aligned execution looks like.",
      },
      {
        name: "Hypothesis Generation",
        detail:
          "Performs step-level intent inference for each significant action across the trajectory.",
      },
      {
        name: "Deviation Analysis",
        detail:
          "Uses perspective-taking and the task baseline to evaluate actual versus predicted execution.",
      },
      {
        name: "Pattern Analysis",
        detail:
          "Synthesizes observations across the long-horizon trajectory to distinguish mistakes from malicious patterns.",
      },
      {
        name: "Evidence Collection",
        detail:
          "Gathers concrete, grounded evidence before formulating the classification decision using the memory learned rules.",
      },
    ],
  },
];
