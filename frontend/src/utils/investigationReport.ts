import { jsPDF } from "jspdf";
import type { Investigation } from "./investigationStore";
import {
  parseEvidenceDisplay,
  type PipelineEvidence,
} from "./evidencePipeline";
import type { ModelReasoningSection } from "./modelReasoning";

export interface InvestigationReportOptions {
  investigation: Investigation;
  applicationName?: string;
  techniqueLabel: string;
  userTask?: string;
  prediction?: string;
  pipeline: PipelineEvidence[];
  reasoningSections?: ModelReasoningSection[] | null;
}

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 48;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

const INK = { r: 28, g: 25, b: 23 };
const MUTED = { r: 87, g: 83, b: 78 };
const RULE = { r: 214, g: 211, b: 209 };
const KICKER = { r: 1, g: 105, b: 183 };
const PAPER = { r: 250, g: 246, b: 239 };
const MALICIOUS = { r: 180, g: 35, b: 24 };
const BENIGN = { r: 6, g: 118, b: 71 };
const WARNING = { r: 181, g: 71, b: 8 };

function pdfSafe(value: string): string {
  return value
    .replace(/\u00a0/g, " ")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/\u2193/g, "->")
    .replace(/[^\t\n\r\x20-\x7E]/g, " ");
}

function slugFilename(name: string, id: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${slug || "investigation"}-${id.slice(0, 8)}.pdf`;
}

function formatTimestamp(value?: number): string {
  if (!value) {
    return "-";
  }
  return new Date(value).toISOString();
}

function classificationOf(investigation: Investigation): {
  label: string;
  color: { r: number; g: number; b: number };
} {
  if (investigation.status === "failed") {
    return { label: "Failed", color: WARNING };
  }
  if (investigation.verdict === "malicious") {
    return { label: "Malicious", color: MALICIOUS };
  }
  if (investigation.verdict === "benign") {
    return { label: "Benign", color: BENIGN };
  }
  return { label: investigation.verdict, color: MUTED };
}

function downloadInvestigationPdf(options: InvestigationReportOptions): void {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  let y = MARGIN;

  const setColor = (color: { r: number; g: number; b: number }) => {
    doc.setTextColor(color.r, color.g, color.b);
  };

  const lineHeight = (size: number) => size * 1.35;

  const ensureSpace = (height: number) => {
    if (y + height <= PAGE_HEIGHT - MARGIN) {
      return;
    }
    doc.addPage();
    y = MARGIN;
  };

  const addWrapped = (
    text: string,
    size: number,
    style: "normal" | "bold",
    color: { r: number; g: number; b: number },
    gapAfter = 8,
    width = CONTENT_WIDTH,
  ) => {
    const safe = pdfSafe(text).trim();
    if (!safe) {
      return;
    }
    doc.setFont("helvetica", style);
    doc.setFontSize(size);
    setColor(color);
    const lines = doc.splitTextToSize(safe, width) as string[];
    const block = lines.length * lineHeight(size);
    ensureSpace(block + 4);
    doc.text(lines, MARGIN, y + size);
    y += block + gapAfter;
  };

  const addKicker = (label: string) => {
    addWrapped(label.toUpperCase(), 8, "bold", KICKER, 4);
  };

  const addRule = () => {
    ensureSpace(16);
    doc.setDrawColor(RULE.r, RULE.g, RULE.b);
    doc.setLineWidth(0.6);
    doc.line(MARGIN, y, PAGE_WIDTH - MARGIN, y);
    y += 14;
  };

  const addExcerpt = (text: string) => {
    const safe = pdfSafe(text).trim();
    if (!safe) {
      return;
    }
    doc.setFont("courier", "normal");
    doc.setFontSize(8.5);
    const innerWidth = CONTENT_WIDTH - 20;
    const lines = doc.splitTextToSize(safe, innerWidth) as string[];
    const boxHeight = lines.length * 11 + 18;
    ensureSpace(boxHeight + 10);
    doc.setFillColor(PAPER.r, PAPER.g, PAPER.b);
    doc.setDrawColor(RULE.r, RULE.g, RULE.b);
    doc.setLineWidth(0.6);
    doc.roundedRect(MARGIN, y, CONTENT_WIDTH, boxHeight, 4, 4, "FD");
    setColor(INK);
    doc.text(lines, MARGIN + 10, y + 16);
    y += boxHeight + 12;
  };

  const { investigation, applicationName, techniqueLabel, userTask, prediction, pipeline, reasoningSections } =
    options;
  const classification = classificationOf(investigation);

  addKicker("Investigation report");
  addWrapped(investigation.name, 20, "bold", INK, 6);
  addWrapped(classification.label, 14, "bold", classification.color, 12);

  addRule();

  const meta: Array<[string, string]> = [
    ["Application", applicationName ?? investigation.applicationId ?? "-"],
    ["Classification", classification.label],
    ["Method", techniqueLabel],
    ["Model", investigation.model ?? "-"],
    ["Status", investigation.status ?? "-"],
    ["Created", formatTimestamp(investigation.createdAt)],
    ["Completed", formatTimestamp(investigation.completedAt)],
    ["Investigation ID", investigation.id],
  ];
  if (investigation.trace_id) {
    meta.push(["Trace ID", investigation.trace_id]);
  }

  const column = CONTENT_WIDTH / 2;
  doc.setFontSize(9);
  for (let index = 0; index < meta.length; index += 2) {
    ensureSpace(28);
    const left = meta[index];
    const right = meta[index + 1];
    doc.setFont("helvetica", "bold");
    setColor(KICKER);
    doc.text(left[0].toUpperCase(), MARGIN, y);
    if (right) {
      doc.text(right[0].toUpperCase(), MARGIN + column, y);
    }
    y += 12;
    doc.setFont("helvetica", "normal");
    setColor(INK);
    const leftValue = doc.splitTextToSize(pdfSafe(left[1]), column - 12) as string[];
    const rightValue = right
      ? (doc.splitTextToSize(pdfSafe(right[1]), column - 12) as string[])
      : [];
    const rows = Math.max(leftValue.length, rightValue.length);
    doc.text(leftValue, MARGIN, y);
    if (right) {
      doc.text(rightValue, MARGIN + column, y);
    }
    y += rows * 12 + 8;
  }

  addRule();

  if (userTask) {
    addKicker("User task");
    addWrapped(userTask, 10.5, "normal", INK, 14);
  }

  if (prediction) {
    addKicker("Model prediction");
    addWrapped(prediction, 10.5, "normal", INK, 14);
  }

  if (reasoningSections && reasoningSections.length > 0) {
    addKicker("Model reasoning");
    reasoningSections.forEach((section) => {
      addWrapped(section.title, 12, "bold", INK, 6);
      section.blocks.forEach((block) => {
        if (block.type === "ul") {
          block.items.forEach((item) => {
            addWrapped(`- ${item}`, 10, "normal", MUTED, 6);
          });
        } else {
          addWrapped(block.text, 10, "normal", MUTED, 8);
        }
      });
      y += 6;
    });
  }

  if (pipeline.length > 0) {
    addKicker("Evidence");
    y += 4;
    pipeline.forEach((item, index) => {
      if (index > 0) {
        addRule();
      }
      addWrapped(
        `${index + 1}. ${parseEvidenceDisplay(item).title}`,
        12,
        "bold",
        INK,
        6,
      );
      if (item.description) {
        addWrapped(item.description, 10.5, "normal", MUTED, 8);
      }
      if (item.excerpt) {
        addKicker("Excerpt");
        addExcerpt(item.excerpt);
      }
    });
  }

  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    setColor(MUTED);
    doc.text(
      `${classification.label}  ·  ${page} / ${pageCount}`,
      PAGE_WIDTH / 2,
      PAGE_HEIGHT - 24,
      { align: "center" },
    );
  }

  doc.save(slugFilename(investigation.name, investigation.id));
}

export function downloadInvestigationReport(
  options: InvestigationReportOptions,
): void {
  downloadInvestigationPdf(options);
}
