/**
 * Turns a routing string like "bedrock/global.anthropic.claude-haiku-4-5-20251001-v1:0"
 * into something readable: who makes the model, what it is called, and where it
 * was served from.
 */

export type ModelVendor = "openai" | "google" | "anthropic" | "unknown";

export interface ModelBadge {
  vendor: ModelVendor;
  /** "Claude Haiku 4.5" */
  name: string;
  /** "Bedrock" */
  host: string;
}

const HOSTS: Record<string, string> = {
  azure: "Azure",
  vertex_ai: "Vertex AI",
  bedrock: "Bedrock",
  openai: "OpenAI",
  anthropic: "Anthropic",
  google: "Google",
};

// Words that are a qualifier rather than part of the name, so they stay lower
// case: "GPT-5 mini" rather than "GPT-5 Mini".
const QUALIFIERS = new Set(["mini", "nano", "lite", "preview", "latest"]);

function vendorOf(id: string): ModelVendor {
  if (id.includes("claude") || id.includes("anthropic")) {
    return "anthropic";
  }
  if (id.includes("gemini") || id.includes("gemma")) {
    return "google";
  }
  if (/\bgpt|^o\d/.test(id)) {
    return "openai";
  }
  return "unknown";
}

function cleanId(raw: string): string {
  return (
    raw
      // Bedrock prefixes the region scope and the model vendor.
      .replace(/^global\./, "")
      .replace(/^(anthropic|amazon|meta|mistral|cohere|ai21)\./, "")
      // ...and suffixes a build date and a revision.
      .replace(/-v\d+(?::\d+)?$/, "")
      .replace(/-\d{8}$/, "")
  );
}

function prettyName(id: string): string {
  const parts = id.split("-").filter(Boolean);
  const words: string[] = [];
  for (const part of parts) {
    // Consecutive version numbers are one version: claude-haiku-4-5 is 4.5.
    if (/^\d+$/.test(part) && /^[\d.]+$/.test(words[words.length - 1] ?? "")) {
      words[words.length - 1] = `${words[words.length - 1]}.${part}`;
      continue;
    }
    if (/^\d/.test(part) || QUALIFIERS.has(part)) {
      words.push(part);
      continue;
    }
    if (part === "gpt") {
      words.push("GPT");
      continue;
    }
    words.push(part.charAt(0).toUpperCase() + part.slice(1));
  }
  // "GPT" reads as one token with the model number it labels.
  if (words[0] === "GPT" && words.length > 1) {
    return [`GPT-${words[1]}`, ...words.slice(2)].join(" ");
  }
  return words.join(" ");
}

export function describeModel(model: string): ModelBadge {
  const slash = model.indexOf("/");
  const hostKey = slash > 0 ? model.slice(0, slash) : "";
  const id = cleanId(slash > 0 ? model.slice(slash + 1) : model);
  return {
    vendor: vendorOf(id),
    name: prettyName(id) || model,
    host: HOSTS[hostKey] ?? hostKey,
  };
}
