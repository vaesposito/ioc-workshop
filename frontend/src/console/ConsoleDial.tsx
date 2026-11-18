import { useId } from "react";

/** Where the ring starts and how far it goes, leaving a gap at the bottom. */
const START = 215;
const SWEEP = 290;

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
 * One figure as an open ring: the share it stands for is drawn in the app's
 * own colour and glows, the rest of the ring stays as the track behind it.
 */
export function ConsoleDial({
  value,
  from,
  to,
  size = 132,
  label,
  bare = false,
}: {
  /** A share of one. */
  value: number;
  /** The two ends of the ring's gradient, in that order. */
  from: string;
  to: string;
  size?: number;
  /** Read out in place of the ring. */
  label: string;
  /** Leave the hole empty, where the figure is already said beside it. */
  bare?: boolean;
}) {
  const uid = useId().replace(/:/g, "");
  const share = Math.max(0, Math.min(1, value));
  const radius = 48;
  const stroke = 7;

  return (
    <span
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
      role="img"
      aria-label={label}
    >
      <svg viewBox="0 0 120 120" width="100%" height="100%" aria-hidden>
        <defs>
          <linearGradient id={`${uid}-ink`} x1="0" y1="1" x2="1" y2="0">
            <stop offset="0%" stopColor={from} />
            <stop offset="100%" stopColor={to} />
          </linearGradient>
          {/* Drawn over the whole dial rather than over the path, so a short
              arc keeps the same glow as a long one. */}
          <filter
            id={`${uid}-glow`}
            filterUnits="userSpaceOnUse"
            x="0"
            y="0"
            width="120"
            height="120"
          >
            <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <path
          d={arc(radius, START, SWEEP)}
          fill="none"
          stroke="color-mix(in srgb, var(--ioc-text) 14%, transparent)"
          strokeWidth={stroke}
          strokeLinecap="round"
        />
        {share > 0 ? (
          <path
            d={arc(radius, START, Math.max(SWEEP * share, 2))}
            fill="none"
            stroke={`url(#${uid}-ink)`}
            strokeWidth={stroke}
            strokeLinecap="round"
            filter={`url(#${uid}-glow)`}
          />
        ) : null}
      </svg>

      {bare ? null : (
        <span className="ioc-fg absolute flex items-baseline font-light leading-none">
          <span style={{ fontSize: size * 0.3 }}>
            {Math.round(share * 100)}
          </span>
          <span className="ioc-faint" style={{ fontSize: size * 0.15 }}>
            %
          </span>
        </span>
      )}
    </span>
  );
}
