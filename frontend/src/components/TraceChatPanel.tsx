import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { LuBot, LuChevronDown, LuUser, LuWrench } from "react-icons/lu";
import {
  clusterChatEvents,
  findEventForEvidence,
  markId,
  type HighlightRange,
  type VisualizerEvent,
} from "../utils/traceVisualizer";

function eventIsFocused(
  event: VisualizerEvent,
  focusEvidenceId: string | null,
): boolean {
  return Boolean(
    focusEvidenceId && event.matchedEvidenceIds.includes(focusEvidenceId),
  );
}

// With an evidence in focus only its own rows read as cited; otherwise every cited row does.
function isCitedRow(
  event: VisualizerEvent,
  focusEvidenceId: string | null,
): boolean {
  return focusEvidenceId
    ? event.matchedEvidenceIds.includes(focusEvidenceId)
    : event.highlighted;
}

function visibleHighlights(
  event: VisualizerEvent,
  focusEvidenceId: string | null,
): HighlightRange[] {
  return focusEvidenceId
    ? event.highlights.filter((range) => range.evidenceId === focusEvidenceId)
    : event.highlights;
}

export type CiteTone = "danger" | "success" | "warning";

/** Evidence id -> tone of its own `benign` flag; evidence without a flag is left out. */
export function evidenceCiteTones(
  evidence: Array<{ id: string; benign?: 0 | 1 }>,
): Record<string, CiteTone> {
  const tones: Record<string, CiteTone> = {};
  for (const item of evidence) {
    if (item.benign === 1) {
      tones[item.id] = "success";
    } else if (item.benign === 0) {
      tones[item.id] = "danger";
    }
  }
  return tones;
}

const EvidenceToneContext = createContext<Record<string, CiteTone>>({});
const FocusedEventContext = createContext<string | null>(null);
const NO_TONES: Record<string, CiteTone> = {};

// Without a tone the row inherits the panel (verdict) tone.
function useRowTone(
  event: VisualizerEvent,
  focusEvidenceId: string | null,
): CiteTone | undefined {
  const tones = useContext(EvidenceToneContext);
  if (focusEvidenceId && event.matchedEvidenceIds.includes(focusEvidenceId)) {
    const focused = tones[focusEvidenceId];
    if (focused) {
      return focused;
    }
  }
  for (const id of event.matchedEvidenceIds) {
    if (tones[id]) {
      return tones[id];
    }
  }
  return undefined;
}

function focusGlowClass(on: boolean): string {
  return on ? "ioc-focus-glow" : "";
}

function queryPanelNode(
  root: HTMLElement | null,
  id: string,
): HTMLElement | null {
  if (!root) {
    return null;
  }
  const escaped = CSS.escape(id);
  return root.querySelector(`#${escaped}`);
}

function actionGroupId(clusterKey: string): string {
  return `group:${clusterKey}`;
}

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function isVerticallyScrollable(element: HTMLElement): boolean {
  const overflowY = window.getComputedStyle(element).overflowY;
  if (overflowY !== "auto" && overflowY !== "scroll" && overflowY !== "overlay") {
    return false;
  }
  return element.scrollHeight > element.clientHeight + 1;
}

function nearestScrollable(node: HTMLElement): HTMLElement | null {
  const preferred = node.closest(".ioc-chat-scroll");
  if (preferred instanceof HTMLElement && isVerticallyScrollable(preferred)) {
    return preferred;
  }
  let current: HTMLElement | null = node.parentElement;
  while (current) {
    if (isVerticallyScrollable(current)) {
      return current;
    }
    current = current.parentElement;
  }
  return preferred instanceof HTMLElement ? preferred : null;
}

function scrollTraceNodeIntoView(node: HTMLElement) {
  const behavior: ScrollBehavior = prefersReducedMotion() ? "auto" : "smooth";
  const scroller = nearestScrollable(node);
  if (scroller) {
    const nodeRect = node.getBoundingClientRect();
    const scrollerRect = scroller.getBoundingClientRect();
    const delta =
      nodeRect.height > scrollerRect.height
        ? nodeRect.top - scrollerRect.top
        : nodeRect.top -
          scrollerRect.top -
          (scrollerRect.height - nodeRect.height) / 2;
    scroller.scrollTo({
      top: Math.max(0, scroller.scrollTop + delta),
      left: 0,
      behavior,
    });
    return;
  }
  node.scrollIntoView({
    behavior,
    block: "center",
    inline: "nearest",
  });
}

function eventIsCollapsible(event: VisualizerEvent): boolean {
  const text = event.text.trim();
  if (!text) {
    return false;
  }
  const compact = text.replace(/\s+/g, " ");
  return compact.length > 160 || text.split("\n").length > 2;
}

function previewText(text: string, ranges: HighlightRange[]): string {
  const collapsed = text.replace(/\s+/g, " ").trim();
  if (!collapsed) {
    return "";
  }
  const range = ranges[0];
  if (range) {
    const start = Math.max(0, range.start - 48);
    const end = Math.min(text.length, range.end + 48);
    const snippet = text.slice(start, end).replace(/\s+/g, " ").trim();
    const prefix = start > 0 ? "…" : "";
    const suffix = end < text.length ? "…" : "";
    return `${prefix}${snippet}${suffix}`;
  }
  if (collapsed.length <= 160) {
    return collapsed;
  }
  return `${collapsed.slice(0, 160).trimEnd()}…`;
}

function HighlightedBody(props: {
  event: VisualizerEvent;
  focusEvidenceId: string | null;
  showCited?: boolean;
}) {
  if (!props.event.unanswered) {
    return <HighlightedText {...props} />;
  }
  return (
    <>
      <HighlightedText {...props} />
      <p className="ioc-chat-empty">No response</p>
    </>
  );
}

function HighlightedText({
  event,
  focusEvidenceId,
  showCited = true,
}: {
  event: VisualizerEvent;
  focusEvidenceId: string | null;
  showCited?: boolean;
}) {
  const text = event.text;
  if (event.empty) {
    return <p className="ioc-chat-empty">Empty response</p>;
  }
  if (!text) {
    return null;
  }

  const ranges = showCited
    ? [...visibleHighlights(event, focusEvidenceId)]
        .filter((range) => range.end > range.start)
        .sort((a, b) => a.start - b.start)
    : [];

  if (ranges.length === 0) {
    return <pre className="ioc-chat-body">{text}</pre>;
  }

  const parts: ReactNode[] = [];
  let cursor = 0;
  ranges.forEach((range, index) => {
    const start = Math.max(cursor, range.start);
    const end = Math.max(start, range.end);
    if (start > cursor) {
      parts.push(text.slice(cursor, start));
    }
    if (end > start) {
      parts.push(
        <mark
          key={`${range.evidenceId}-${index}`}
          id={markId(event.id, range.evidenceId)}
          className={`ioc-chat-mark${
            focusEvidenceId === range.evidenceId ? " ioc-chat-mark-focus" : ""
          }`}
        >
          {text.slice(start, end)}
        </mark>,
      );
    }
    cursor = Math.max(cursor, end);
  });
  if (cursor < text.length) {
    parts.push(text.slice(cursor));
  }

  return <pre className="ioc-chat-body">{parts}</pre>;
}

function ChatMeta({
  collapsible,
  expanded,
  onToggle,
  leading,
  cited,
  title,
}: {
  collapsible: boolean;
  expanded: boolean;
  onToggle: () => void;
  leading?: ReactNode;
  cited?: boolean;
  title?: string;
}) {
  const labeled = Boolean(leading || title || cited);
  const toggleClass = `ioc-chat-toggle${labeled ? " is-labeled" : ""}`;
  const inner = (
    <>
      <span className="ioc-chat-meta">
        {leading}
        {title ? <span className="ioc-chat-role">{title}</span> : null}
        {cited ? <span className="ioc-chat-cited-label">Cited</span> : null}
      </span>
      {collapsible ? (
        <LuChevronDown
          size={14}
          className={`ioc-chat-chevron ${expanded ? "rotate-180" : ""}`}
        />
      ) : null}
    </>
  );

  if (!collapsible && !title && !cited) {
    return null;
  }

  if (!collapsible) {
    return <div className={toggleClass}>{inner}</div>;
  }

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={expanded}
      className={toggleClass}
    >
      {inner}
    </button>
  );
}

function Speaker({ side }: { side: "user" | "agent" }) {
  const isUser = side === "user";
  return (
    <div className="ioc-chat-identity">
      <span
        className={`ioc-chat-avatar ${isUser ? "ioc-chat-avatar-user" : "ioc-chat-avatar-agent"}`}
        aria-hidden="true"
      >
        {isUser ? <LuUser size={14} /> : <LuBot size={14} />}
      </span>
      <span className="ioc-chat-who">{isUser ? "User" : "Agent"}</span>
    </div>
  );
}

function MessageBubble({
  event,
  side,
  expanded,
  focusEvidenceId,
  showCited,
  onToggle,
}: {
  event: VisualizerEvent;
  side: "user" | "agent";
  expanded: boolean;
  focusEvidenceId: string | null;
  showCited: boolean;
  onToggle: () => void;
}) {
  const isUser = side === "user";
  const collapsible = eventIsCollapsible(event);
  const showBody = !collapsible || expanded;
  const preview = previewText(
    event.text,
    showCited ? visibleHighlights(event, focusEvidenceId) : [],
  );
  const cited = showCited && isCitedRow(event, focusEvidenceId);
  const focusedEventId = useContext(FocusedEventContext);
  const focused =
    event.id === focusedEventId ||
    (showCited && eventIsFocused(event, focusEvidenceId));
  const tone = useRowTone(event, focusEvidenceId);

  return (
    <div
      id={event.id}
      className={`ioc-chat-bubble ${
        isUser ? "ioc-chat-bubble-user" : "ioc-chat-bubble-agent"
      } ${cited ? "ioc-chat-cited" : ""} ${focusGlowClass(focused)}`}
      data-cite-tone={cited ? tone : undefined}
    >
      <ChatMeta
        collapsible={collapsible}
        expanded={expanded}
        cited={cited}
        onToggle={onToggle}
      />
      {showBody ? (
        <HighlightedBody
          event={event}
          focusEvidenceId={showCited ? focusEvidenceId : null}
          showCited={showCited}
        />
      ) : preview ? (
        <p className="ioc-chat-preview">{preview}</p>
      ) : null}
    </div>
  );
}

function ChatBubble({
  event,
  side,
  expanded,
  focusEvidenceId,
  showCited,
  onToggle,
}: {
  event: VisualizerEvent;
  side: "user" | "agent";
  expanded: boolean;
  focusEvidenceId: string | null;
  showCited: boolean;
  onToggle: () => void;
}) {
  const isUser = side === "user";

  return (
    <li
      className={`ioc-chat-row ${isUser ? "ioc-chat-row-user" : "ioc-chat-row-agent"}`}
    >
      <Speaker side={side} />
      <div className="ioc-chat-stack">
        <MessageBubble
          event={event}
          side={side}
          expanded={expanded}
          focusEvidenceId={focusEvidenceId}
          showCited={showCited}
          onToggle={onToggle}
        />
      </div>
    </li>
  );
}

function BehindTheScenes({
  groupId,
  events,
  expandedIds,
  focusEvidenceId,
  showCited,
  onToggle,
}: {
  groupId: string;
  events: VisualizerEvent[];
  expandedIds: Set<string>;
  focusEvidenceId: string | null;
  showCited: boolean;
  onToggle: (id: string) => void;
}) {
  const groupOpen = expandedIds.has(groupId);
  const cited =
    showCited && events.some((event) => isCitedRow(event, focusEvidenceId));
  const focusedEventId = useContext(FocusedEventContext);
  const focused =
    events.some((event) => event.id === focusedEventId) ||
    (showCited && events.some((event) => eventIsFocused(event, focusEvidenceId)));
  return (
    <div
      id={groupId}
      className={`ioc-chat-actions ${focusGlowClass(focused)}`}
    >
      <button
        type="button"
        onClick={() => onToggle(groupId)}
        aria-expanded={groupOpen}
        className="ioc-chat-toggle is-labeled"
      >
        <span className="ioc-chat-actions-label">
          <LuWrench size={12} />
          Behind the scenes
          <span className="ioc-faint font-light tracking-normal normal-case">
            · {events.length}
          </span>
          {cited ? <span className="ioc-chat-cited-label">Cited</span> : null}
        </span>
        <LuChevronDown
          size={14}
          className={`ioc-chat-chevron ${groupOpen ? "rotate-180" : ""}`}
        />
      </button>
      {groupOpen ? (
        <ol>
          {events.map((event) => (
            <ActionRow
              key={event.id}
              event={event}
              expanded={expandedIds.has(event.id)}
              focusEvidenceId={focusEvidenceId}
              showCited={showCited}
              onToggle={() => onToggle(event.id)}
            />
          ))}
        </ol>
      ) : null}
    </div>
  );
}

function AgentTurn({
  cluster,
  expandedIds,
  focusEvidenceId,
  showCited,
  onToggle,
}: {
  cluster: Extract<ReturnType<typeof clusterChatEvents>[number], { variant: "agent" }>;
  expandedIds: Set<string>;
  focusEvidenceId: string | null;
  showCited: boolean;
  onToggle: (id: string) => void;
}) {
  const message = cluster.event?.text.trim() ? cluster.event : null;
  return (
    <li className="ioc-chat-row ioc-chat-row-agent">
      <Speaker side="agent" />
      <div className="ioc-chat-stack">
        {message ? (
          <MessageBubble
            event={message}
            side="agent"
            expanded={expandedIds.has(message.id)}
            focusEvidenceId={focusEvidenceId}
            showCited={showCited}
            onToggle={() => onToggle(message.id)}
          />
        ) : null}
        {cluster.actions.length > 0 ? (
          <BehindTheScenes
            groupId={actionGroupId(cluster.key)}
            events={cluster.actions}
            expandedIds={expandedIds}
            focusEvidenceId={focusEvidenceId}
            showCited={showCited}
            onToggle={onToggle}
          />
        ) : null}
      </div>
    </li>
  );
}

function ActionRow({
  event,
  expanded,
  focusEvidenceId,
  showCited,
  onToggle,
}: {
  event: VisualizerEvent;
  expanded: boolean;
  focusEvidenceId: string | null;
  showCited: boolean;
  onToggle: () => void;
}) {
  const collapsible = eventIsCollapsible(event);
  const showBody = !collapsible || expanded;
  const preview = previewText(
    event.text,
    showCited ? visibleHighlights(event, focusEvidenceId) : [],
  );
  const cited = showCited && isCitedRow(event, focusEvidenceId);
  const focusedEventId = useContext(FocusedEventContext);
  const focused =
    event.id === focusedEventId ||
    (showCited && eventIsFocused(event, focusEvidenceId));
  const isAgentTurn = event.kind === "assistant" || event.kind === "reasoning";
  const tone = useRowTone(event, focusEvidenceId);
  return (
    <li
      id={event.id}
      className={`ioc-chat-action ${isAgentTurn ? "is-agent" : ""} ${cited ? "ioc-chat-cited" : ""} ${focusGlowClass(focused)}`}
      data-cite-tone={cited ? tone : undefined}
    >
      <ChatMeta
        collapsible={collapsible}
        expanded={expanded}
        cited={cited}
        title={event.title}
        onToggle={onToggle}
        leading={isAgentTurn ? <LuBot size={12} /> : <LuWrench size={12} />}
      />
      {showBody ? (
        <HighlightedBody
          event={event}
          focusEvidenceId={showCited ? focusEvidenceId : null}
          showCited={showCited}
        />
      ) : preview ? (
        <p className="ioc-chat-preview">{preview}</p>
      ) : null}
    </li>
  );
}

export function TraceChatPanel({
  events,
  focusEvidenceId = null,
  focusEventId = null,
  focusNonce = 0,
  isLoading = false,
  error = null,
  showToolbar = true,
  showCited = true,
  citeTone = "danger",
  evidenceTones,
}: {
  events: VisualizerEvent[];
  focusEvidenceId?: string | null;
  focusEventId?: string | null;
  focusNonce?: number;
  isLoading?: boolean;
  error?: string | null;
  showToolbar?: boolean;
  showCited?: boolean;
  citeTone?: CiteTone;
  evidenceTones?: Record<string, CiteTone>;
}) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const collapsedByUserRef = useRef(new Set<string>());
  const clusters = useMemo(() => clusterChatEvents(events), [events]);
  const eventsRef = useRef(events);
  const clustersRef = useRef(clusters);
  eventsRef.current = events;
  clustersRef.current = clusters;
  const actionGroupIds = useMemo(
    () =>
      clusters
        .filter(
          (cluster): cluster is Extract<typeof cluster, { variant: "agent" }> =>
            cluster.variant === "agent" && cluster.actions.length > 0,
        )
        .map((cluster) => actionGroupId(cluster.key)),
    [clusters],
  );

  // Only turns that can actually collapse count, so the toggle reports the
  // real state rather than waiting on rows that never expand.
  const expandableIds = useMemo(
    () => [
      ...events.filter(eventIsCollapsible).map((event) => event.id),
      ...actionGroupIds,
    ],
    [events, actionGroupIds],
  );
  const allExpanded =
    expandableIds.length > 0 && expandableIds.every((id) => expandedIds.has(id));

  const focusedEvent = focusEventId
    ? events.find((event) => event.id === focusEventId)
    : focusEvidenceId
      ? findEventForEvidence(events, focusEvidenceId)
      : undefined;
  const focusedEventId = focusedEvent?.id ?? null;

  useEffect(() => {
    if (!focusEvidenceId && !focusEventId) {
      return;
    }
    const currentEvents = eventsRef.current;
    const currentClusters = clustersRef.current;
    const focused = focusEventId
      ? currentEvents.find((event) => event.id === focusEventId)
      : findEventForEvidence(currentEvents, focusEvidenceId!);
    if (!focused) {
      return;
    }
    const group = currentClusters.find(
      (cluster) =>
        cluster.variant === "agent" &&
        cluster.actions.some((event) => event.id === focused.id),
    );
    const groupId = group ? actionGroupId(group.key) : null;
    collapsedByUserRef.current.delete(focused.id);
    if (groupId) {
      collapsedByUserRef.current.delete(groupId);
    }
    setExpandedIds((current) => {
      const next = new Set(current);
      next.add(focused.id);
      if (groupId) {
        next.add(groupId);
      }
      return next;
    });

    const timers: number[] = [];
    let attempts = 0;
    const tryScroll = () => {
      const root = panelRef.current;
      const mark =
        focusEvidenceId && !focusEventId
          ? queryPanelNode(root, markId(focused.id, focusEvidenceId))
          : null;
      const node =
        mark ??
        queryPanelNode(root, focused.id) ??
        (groupId ? queryPanelNode(root, groupId) : null);
      if (node) {
        scrollTraceNodeIntoView(node);
        if (mark || queryPanelNode(root, focused.id) || attempts >= 8) {
          return;
        }
      }
      if (attempts < 16) {
        attempts += 1;
        timers.push(window.setTimeout(tryScroll, 50));
      }
    };
    timers.push(window.setTimeout(tryScroll, 0));
    return () => {
      for (const timer of timers) {
        window.clearTimeout(timer);
      }
    };
  }, [focusEvidenceId, focusEventId, focusNonce, focusedEventId]);

  function toggleEvent(eventId: string) {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(eventId)) {
        next.delete(eventId);
        collapsedByUserRef.current.add(eventId);
      } else {
        next.add(eventId);
        collapsedByUserRef.current.delete(eventId);
      }
      return next;
    });
  }

  if (isLoading) {
    return (
      <p className="ioc-faint py-10 text-center text-sm font-light">
        Loading trace...
      </p>
    );
  }

  if (events.length === 0) {
    return (
      <div className="ioc-glass rounded-xl px-6 py-12 text-center">
        <p className="ioc-copy">
          {error ? error : "This trace has no conversation turns to display."}
        </p>
      </div>
    );
  }

  return (
    <div
      ref={panelRef}
      className="ioc-chat-panel ioc-cite-panel flex flex-col gap-6"
      data-cite-tone={citeTone}
    >
      {showToolbar ? (
        <div className="ioc-chat-toolbar flex flex-wrap items-center justify-between gap-2">
          <p className="ioc-faint text-xs">
            {events.length} turn{events.length === 1 ? "" : "s"} · all
            collapsed
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setExpandedIds(new Set())}
              className="ioc-btn-ghost px-2.5 py-1 text-[11px]"
            >
              Collapse all
            </button>
            <button
              type="button"
              onClick={() =>
                setExpandedIds(
                  new Set([
                    ...events.map((event) => event.id),
                    ...actionGroupIds,
                  ]),
                )
              }
              className="ioc-btn-ghost px-2.5 py-1 text-[11px]"
            >
              Expand all
            </button>
          </div>
        </div>
      ) : null}

      {!showToolbar && expandableIds.length > 0 ? (
        <button
          type="button"
          onClick={() =>
            setExpandedIds(allExpanded ? new Set() : new Set(expandableIds))
          }
          className="ioc-link -mb-3 self-end text-[11px]"
        >
          {allExpanded ? "Collapse all" : "Expand all"}
        </button>
      ) : null}

      <EvidenceToneContext.Provider value={evidenceTones ?? NO_TONES}>
      <FocusedEventContext.Provider value={focusEventId}>
      <ol className="ioc-chat">
        {showCited && focusEvidenceId && !focusedEvent ? (
          <li className="sev-warning rounded-lg border px-4 py-3 text-[13px] font-light">
            Cited evidence could not be located in the stored conversation.
          </li>
        ) : null}
        {clusters.map((cluster) => {
          if (cluster.variant === "agent") {
            return (
              <AgentTurn
                key={cluster.key}
                cluster={cluster}
                expandedIds={expandedIds}
                focusEvidenceId={focusEvidenceId}
                showCited={showCited}
                onToggle={toggleEvent}
              />
            );
          }
          return (
            <ChatBubble
              key={cluster.key}
              event={cluster.event}
              side="user"
              expanded={expandedIds.has(cluster.event.id)}
              focusEvidenceId={focusEvidenceId}
              showCited={showCited}
              onToggle={() => toggleEvent(cluster.event.id)}
            />
          );
        })}
      </ol>
      </FocusedEventContext.Provider>
      </EvidenceToneContext.Provider>
    </div>
  );
}
