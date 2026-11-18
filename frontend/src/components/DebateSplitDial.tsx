import { useId } from "react";

/** Where the ring starts and how far round it goes, leaving a gap at the
    bottom so the three shares read as a dial rather than as a pie. */
const START = 240;
const SWEEP = 240;
/** Degrees dropped between two shares, so the colours do not touch. */
const GAP = 5;
/** No share is drawn thinner than this, so a 1% reading is still a mark. */
const MIN = 3;

const PARTS = [
  { key: "honest", stroke: "var(--sev-success)" },
  { key: "infected", stroke: "var(--ioc-watch)" },
  { key: "manipulator", stroke: "var(--sev-danger)" },
] as const;

function polar(radius: number, angleFromTop: number): [number, number] {
  const rad = ((angleFromTop - 90) * Math.PI) / 180;
  return [60 + radius * Math.cos(rad), 60 + radius * Math.sin(rad)];
}

function arc(radius: number, start: number, sweep: number): string {
  const [x1, y1] = polar(radius, start);
  const [x2, y2] = polar(radius, start + sweep);
  return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${radius} ${radius} 0 ${
    sweep > 180 ? 1 : 0
  } 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
}

/**
 * One agent's reading as an open dial: the three shares Agent-ToM splits a
 * point across, laid round a ring that stops short of closing, each share
 * glowing in its own colour. The share that won the reading is read out in
 * the middle.
 */
export function DebateSplitDial({
  scores,
  label,
  value,
  caption,
  tip,
  size = 92,
  edge,
  tipBelow = false,
}: {
  scores: { honest?: number; infected?: number; manipulator?: number };
  /** The reading the detector settled on, which colours the figure. */
  label: string;
  /** The score behind that reading, as a share of one. */
  value?: number | null;
  /** Read out by a screen reader in place of the ring, and shown on hover
      where no tooltip of its own is given. */
  caption: string;
  /** The three shares in words, shown on hover. */
  tip?: string;
  size?: number;
  /** Which side of its row the dial sits on, so a tooltip wider than the
      dial hangs inwards rather than over the edge of the column. */
  edge?: "start" | "end";
  /** Set on the top row, where there is nothing above to hang a tip in. */
  tipBelow?: boolean;
}) {
  const uid = useId().replace(/:/g, "");
  const radius = 48;
  const stroke = 6;
  const values = PARTS.map((part) => Math.max(0, scores[part.key] ?? 0));
  const total = values.reduce((sum, share) => sum + share, 0) || 1;
  // The figure is the reading the detector settled on, not the largest
  // share: the two can differ, and the reading is what the page says.
  const lead = PARTS.find((part) => part.key === label) ?? PARTS[0];
  const read = Math.round((value ?? scores[lead.key] ?? 0) * 100);

  let at = START;
  return (
    <span
      className={`ioc-split-dial${edge ? ` is-${edge}` : ""}${
        tipBelow ? " is-below" : ""
      }`}
      // Drawn to the width it is given rather than to a fixed figure, so a
      // dial fills the column it sits in and only stops growing at its own
      // ceiling.
      style={{ width: "100%", maxWidth: size, aspectRatio: "1" }}
      data-tip={tip ?? caption}
      role="img"
      aria-label={caption}
    >
      <svg viewBox="0 0 120 120" width="100%" height="100%" aria-hidden>
        <defs>
          {/* One region for every share, in the dial's own coordinates: a
              per-path region is as small as the path, which crops the glow
              off the short ones. */}
          <filter
            id={`${uid}-glow`}
            filterUnits="userSpaceOnUse"
            x="0"
            y="0"
            width="120"
            height="120"
          >
            <feGaussianBlur
              in="SourceGraphic"
              stdDeviation="2.6"
              result="blur"
            />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <path
          d={arc(radius, START, SWEEP)}
          fill="none"
          stroke="color-mix(in srgb, var(--ioc-text) 10%, transparent)"
          strokeWidth={stroke}
          strokeLinecap="round"
        />

        {PARTS.map((part, index) => {
          const span = (values[index] / total) * SWEEP;
          const from = at;
          at += span;
          if (values[index] <= 0) {
            return null;
          }
          // Every share is drawn flat-ended and the same width: a round cap
          // on a short one is wider than the share itself, which reads as a
          // thicker line rather than as a smaller number. A share too thin
          // to see is widened around its own middle, so it still sits where
          // it belongs on the ring.
          const drawn = Math.max(span - GAP, MIN);
          const begin = from + span / 2 - drawn / 2;
          return (
            <path
              key={part.key}
              d={arc(radius, begin, drawn)}
              fill="none"
              stroke={part.stroke}
              strokeWidth={stroke}
              strokeLinecap="butt"
              filter={`url(#${uid}-glow)`}
            />
          );
        })}
      </svg>
      <span className="ioc-split-dial-read" style={{ color: lead.stroke }}>
        {read}%
      </span>
    </span>
  );
}
