import {
  LuBot,
  LuChevronRight,
  LuDownload,
  LuGlobe,
  LuMessageSquare,
  LuSettings2,
  LuUser,
  LuWrench,
} from "react-icons/lu";
import { useState } from "react";
import type {
  ConversationTurn,
  InvestigationMemory,
  ToolCall,
} from "../utils/investigationStore";

interface MemoryPanelProps {
  memory: InvestigationMemory;
  investigationId: string;
}

function downloadJson(data: InvestigationMemory, investigationId: string) {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `memory-${investigationId}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function ToolCallCard({ call }: { call: ToolCall }) {
  const [expanded, setExpanded] = useState(false);
  const hasBody = call.result !== undefined;

  return (
    <div className="rounded-lg border border-gray-200 bg-white overflow-hidden text-xs">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-2 w-full px-3 py-2 hover:bg-gray-50 transition-colors"
      >
        <LuChevronRight
          size={12}
          className={`text-gray-400 shrink-0 transition-transform duration-150 ${expanded ? "rotate-90" : ""}`}
        />
        <LuWrench size={12} className="text-gray-400 shrink-0" />
        <span className="font-mono font-medium text-gray-700">{call.name}</span>
        {call.host_contacted && (
          <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 border border-sky-200 text-sky-700 px-1.5 py-0.5 text-[10px] font-medium ml-auto shrink-0">
            <LuGlobe size={9} />
            {call.host_contacted}
          </span>
        )}
      </button>

      {expanded && hasBody && (
        <div className="border-t border-gray-100 divide-y divide-gray-100">
          <div className="px-3 py-2 flex flex-col gap-1">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
              Arguments
            </p>
            <pre className="text-[11px] text-gray-600 leading-relaxed whitespace-pre-wrap break-all font-mono bg-gray-50 rounded px-2 py-1.5">
              {JSON.stringify(call.arguments, null, 2)}
            </pre>
          </div>
          {call.result && (
            <div className="px-3 py-2 flex flex-col gap-1">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                Result
              </p>
              <pre className="text-[11px] text-gray-600 leading-relaxed whitespace-pre-wrap break-all font-mono bg-gray-50 rounded px-2 py-1.5">
                {call.result}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TurnBubble({ turn }: { turn: ConversationTurn }) {
  if (turn.role === "system") {
    return (
      <div className="flex items-start gap-2">
        <div className="flex items-center gap-1.5 w-full rounded-lg bg-gray-100 border border-gray-200 px-3 py-2">
          <LuSettings2 size={12} className="text-gray-400 shrink-0" />
          <p className="text-xs text-gray-500 leading-relaxed">
            {turn.content}
          </p>
        </div>
      </div>
    );
  }

  if (turn.role === "user") {
    return (
      <div className="flex items-start gap-2 justify-end">
        <div className="max-w-[85%] rounded-xl rounded-tr-sm bg-gray-100 border border-gray-200 px-3 py-2">
          <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">
            {turn.content}
          </p>
        </div>
        <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center shrink-0 mt-0.5">
          <LuUser size={12} className="text-gray-500" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2">
      <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center shrink-0 mt-0.5">
        <LuBot size={12} className="text-indigo-500" />
      </div>
      <div className="flex flex-col gap-1.5 max-w-[85%]">
        <div className="rounded-xl rounded-tl-sm bg-white border border-indigo-100 px-3 py-2">
          <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">
            {turn.content}
          </p>
        </div>
        {turn.tool_calls && turn.tool_calls.length > 0 && (
          <div className="flex flex-col gap-1">
            {turn.tool_calls.map((call, i) => (
              <ToolCallCard key={i} call={call} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function MemoryPanel({ memory, investigationId }: MemoryPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const { annotation, raw_conversation_payload } = memory;

  const attackPositive = annotation.attack_label === 1;
  const derailmentPositive = annotation.derailment_label === 1;

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Header — always visible */}
      <div className="flex items-center justify-between px-6 py-4">
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-2"
          aria-expanded={expanded}
        >
          <LuChevronRight
            size={16}
            className={`text-gray-400 transition-transform duration-200 ${expanded ? "rotate-90" : ""}`}
          />
          <span className="text-base font-semibold text-gray-900">
            Memory Used
          </span>
          {/* Quick-glance label badges */}
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
              attackPositive
                ? "bg-red-100 text-red-700"
                : "bg-green-100 text-green-700"
            }`}
          >
            Attack {attackPositive ? "✓" : "✗"}
          </span>
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
              derailmentPositive
                ? "bg-orange-100 text-orange-700"
                : "bg-green-100 text-green-700"
            }`}
          >
            Derailment {derailmentPositive ? "✓" : "✗"}
          </span>
        </button>

        <button
          onClick={() => downloadJson(memory, investigationId)}
          className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-indigo-600 border border-gray-200 hover:border-indigo-300 rounded-md px-3 py-1.5 transition-colors"
        >
          <LuDownload size={13} />
          Download .json
        </button>
      </div>

      {/* Expandable body */}
      {expanded && (
        <div className="border-t border-gray-100 flex flex-col gap-6 px-6 py-5">
          {/* Annotation */}
          <div className="flex flex-col gap-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
              Annotation
            </p>

            {/* Label grid */}
            <div className="grid grid-cols-2 gap-x-8 gap-y-3">
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
                  Attack Label
                </p>
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                    attackPositive
                      ? "bg-red-100 text-red-700"
                      : "bg-green-100 text-green-700"
                  }`}
                >
                  {attackPositive ? "1 · Adversarial compromise" : "0 · Clean"}
                </span>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
                  Derailment Label
                </p>
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                    derailmentPositive
                      ? "bg-orange-100 text-orange-700"
                      : "bg-green-100 text-green-700"
                  }`}
                >
                  {derailmentPositive ? "1 · Issue occurred" : "0 · Normal"}
                </span>
              </div>
              {annotation.domain && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
                    Domain
                  </p>
                  <span className="inline-flex items-center rounded-full bg-sky-100 text-sky-700 px-2 py-0.5 text-xs font-medium">
                    {annotation.domain}
                  </span>
                </div>
              )}
              {annotation.misbehaviour_type && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
                    Misbehaviour Type
                  </p>
                  <span className="inline-flex items-center rounded-full bg-violet-100 text-violet-700 px-2 py-0.5 text-xs font-medium">
                    {annotation.misbehaviour_type}
                  </span>
                </div>
              )}
            </div>

            {/* Explanation */}
            {annotation.misbehaviour_explanation.length > 0 && (
              <div className="flex flex-col gap-1.5 border-l-2 border-orange-200 pl-3">
                {annotation.misbehaviour_explanation.map((sentence, i) => (
                  <p key={i} className="text-sm text-gray-600 leading-relaxed">
                    {sentence}
                  </p>
                ))}
              </div>
            )}
          </div>

          {/* Conversation */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                Raw Conversation
              </p>
              <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 text-gray-600 text-xs font-medium px-2 py-0.5">
                <LuMessageSquare size={10} />
                {raw_conversation_payload.length} turns
              </span>
            </div>
            <div className="flex flex-col gap-2 bg-gray-50 rounded-xl border border-gray-100 p-4">
              {raw_conversation_payload.map((turn, i) => (
                <TurnBubble key={i} turn={turn} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
