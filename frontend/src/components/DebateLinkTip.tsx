import { LuArrowRight, LuTriangleAlert, LuX } from "react-icons/lu";
import {
  linkOutcomeDescription,
  linkOutcomeLabel,
  type DebateEdge,
} from "../utils/madDebates";

/**
 * What one arrow in the graph stands for: which observed turn already carried
 * the answer, whose answer changed to it, and at which round. The full reading
 * stays in the explanation column, so this carries only enough to make the
 * arrow legible where it is drawn.
 */
export function DebateLinkTip({
  edge,
  selectedLinkId,
  onClose,
}: {
  edge: DebateEdge;
  selectedLinkId: string | null;
  onClose: () => void;
}) {
  const link =
    edge.links.find((entry) => entry.id === selectedLinkId) ?? edge.links[0];
  const others = edge.links.length - 1;

  return (
    <aside className="ioc-answer-panel">
      <div className="ioc-answer-panel-head">
        <span className={`ioc-debate-key is-${edge.category}`} aria-hidden />
        <span className="ioc-agent-name">
          {link.fromName}
          <LuArrowRight size={12} aria-hidden="true" />
          {link.toName}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close connection"
          className="ioc-icon-btn"
        >
          <LuX size={14} />
        </button>
      </div>

      <p
        className={`ioc-answer-panel-verdict${edge.attack ? " is-danger" : ""}`}
      >
        {linkOutcomeLabel(edge.category)}
        {link.fromRound ? (
          <span className="ioc-faint text-[11px] font-light">
            from round {link.fromRound}
          </span>
        ) : null}
      </p>

      <p className="ioc-answer-panel-text">
        {link.interpretation || linkOutcomeDescription(edge.category)}
      </p>

      {link.sourceQuote ? (
        <p className="ioc-debate-quote">“{link.sourceQuote}”</p>
      ) : null}

      {link.attack && link.path ? (
        <p className="ioc-debate-lineage">
          <LuTriangleAlert size={11} />
          {link.path.map((step) => `${step.name} R${step.round}`).join(" → ")}
        </p>
      ) : null}

      {others > 0 ? (
        <p className="ioc-faint text-[11px] font-light">
          {others} more reference{others === 1 ? "" : "s"} on this arrow, listed
          in the explanation.
        </p>
      ) : null}
    </aside>
  );
}
