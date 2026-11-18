import { useId, type ReactNode } from "react";
import { LuArrowUpRight } from "react-icons/lu";

export type WidgetTone = "default" | "danger" | "success";

export interface WidgetSegment {
  label: string;
  value: number;
  tone?: WidgetTone;
}

export function valueClass(tone: WidgetTone, value: number): string {
  if (tone === "danger" && value > 0) {
    return "sev-danger-text";
  }
  if (tone === "success" && value > 0) {
    return "sev-success-text";
  }
  return "ioc-fg";
}

export function segmentStroke(tone?: WidgetTone): string {
  if (tone === "danger") {
    return "var(--sev-danger)";
  }
  if (tone === "success") {
    return "var(--sev-success)";
  }
  return "color-mix(in srgb, var(--ioc-kicker) 55%, var(--ioc-text))";
}

function segmentStops(tone?: WidgetTone): { from: string; mid: string; to: string } {
  if (tone === "danger") {
    return {
      from: "color-mix(in srgb, var(--sev-danger) 45%, white)",
      mid: "var(--sev-danger)",
      to: "color-mix(in srgb, var(--sev-danger) 72%, var(--ioc-bg))",
    };
  }
  if (tone === "success") {
    return {
      from: "color-mix(in srgb, var(--sev-success) 45%, white)",
      mid: "var(--sev-success)",
      to: "color-mix(in srgb, var(--sev-success) 72%, var(--ioc-bg))",
    };
  }
  return {
    from: "color-mix(in srgb, var(--ioc-kicker) 70%, white)",
    mid: "var(--ioc-kicker)",
    to: "color-mix(in srgb, var(--ioc-kicker) 55%, var(--ioc-bg))",
  };
}

export function SegmentDonut({
  segments,
  size = 80,
}: {
  segments: WidgetSegment[];
  size?: number;
}) {
  const uid = useId().replace(/:/g, "");
  const stroke = Math.max(8, Math.round(size * 0.1125));
  const radius = Math.max(22, Math.round(size * 0.3375));
  const circumference = 2 * Math.PI * radius;
  const total = segments.reduce(
    (sum, segment) => sum + Math.max(0, segment.value),
    0,
  );
  const dominant =
    segments.reduce<WidgetSegment | null>((best, segment) => {
      if (segment.value <= 0) {
        return best;
      }
      if (!best || segment.value > best.value) {
        return segment;
      }
      return best;
    }, null)?.tone ?? "default";
  let drawn = 0;
  const tones: WidgetTone[] = ["danger", "success", "default"];

  return (
    <span
      className={`ioc-stat-donut is-${dominant}`}
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="ioc-stat-donut-svg"
        aria-hidden="true"
      >
        <defs>
          <radialGradient id={`${uid}-wash`} cx="50%" cy="42%" r="58%">
            <stop
              offset="0%"
              stopColor={segmentStroke(dominant)}
              stopOpacity="0.22"
            />
            <stop
              offset="70%"
              stopColor={segmentStroke(dominant)}
              stopOpacity="0.05"
            />
            <stop offset="100%" stopColor="transparent" stopOpacity="0" />
          </radialGradient>
          {tones.map((tone) => {
            const stops = segmentStops(tone);
            return (
              <linearGradient
                key={tone}
                id={`${uid}-${tone}`}
                x1="18%"
                y1="8%"
                x2="86%"
                y2="92%"
              >
                <stop offset="0%" stopColor={stops.from} />
                <stop offset="48%" stopColor={stops.mid} />
                <stop offset="100%" stopColor={stops.to} />
              </linearGradient>
            );
          })}
          <filter
            id={`${uid}-glow`}
            x="-50%"
            y="-50%"
            width="200%"
            height="200%"
          >
            <feGaussianBlur
              in="SourceGraphic"
              stdDeviation="1.7"
              result="blur"
            />
            <feColorMatrix
              in="blur"
              type="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0.9 0"
              result="glow"
            />
            <feMerge>
              <feMergeNode in="glow" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius - stroke / 2}
          fill={`url(#${uid}-wash)`}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="color-mix(in srgb, var(--ioc-kicker) 18%, var(--ioc-glass-border))"
          strokeWidth={stroke}
        />
        {total > 0
          ? segments.map((segment) => {
              if (segment.value <= 0) {
                return null;
              }
              const length = (segment.value / total) * circumference;
              const gap = Math.min(2.2, length * 0.08);
              const dash = Math.max(length - gap, 0.8);
              const dashoffset = circumference * 0.25 - drawn;
              drawn += length;
              const tone = segment.tone ?? "default";
              return (
                <circle
                  key={segment.label}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="none"
                  stroke={`url(#${uid}-${tone})`}
                  strokeWidth={stroke}
                  strokeLinecap="butt"
                  strokeDasharray={`${dash} ${circumference - dash}`}
                  strokeDashoffset={dashoffset}
                  filter={`url(#${uid}-glow)`}
                />
              );
            })
          : null}
      </svg>
    </span>
  );
}

const GAUGE_START = 248;
const GAUGE_SWEEP = 224;

function polar(
  cx: number,
  cy: number,
  radius: number,
  angleFromTop: number,
): { x: number; y: number } {
  const rad = ((angleFromTop - 90) * Math.PI) / 180;
  return {
    x: cx + radius * Math.cos(rad),
    y: cy + radius * Math.sin(rad),
  };
}

function fmt(value: number): string {
  return value.toFixed(2);
}

function arcPath(
  cx: number,
  cy: number,
  radius: number,
  start: number,
  sweep: number,
): string {
  const from = polar(cx, cy, radius, start);
  const to = polar(cx, cy, radius, start + sweep);
  const large = sweep > 180 ? 1 : 0;
  return `M ${fmt(from.x)} ${fmt(from.y)} A ${fmt(radius)} ${fmt(radius)} 0 ${large} 1 ${fmt(to.x)} ${fmt(to.y)}`;
}

export function SegmentGauge({
  value,
  tone = "default",
  size = 220,
  caption,
}: {
  value: number | null;
  tone?: WidgetTone;
  size?: number;
  caption?: string;
}) {
  const uid = useId().replace(/:/g, "");
  const vb = 240;
  const height = 176;
  const cx = 120;
  const cy = 122;
  const radius = 94;
  const stroke = 7;
  const clamped = value == null ? 0 : Math.max(0, Math.min(100, value));
  const fillSweep = (clamped / 100) * GAUGE_SWEEP;
  const angle = GAUGE_START + fillSweep;
  const needle = polar(cx, cy, radius - stroke * 1.15, angle);
  const stops = segmentStops(tone);
  const ticks = [0, 25, 50, 75, 100];
  const readout = value == null ? "—" : `${Math.round(clamped)}%`;

  return (
    <span
      className={`ioc-stat-gauge is-${tone}`}
      style={{ width: size }}
      role="img"
      aria-label={
        value == null
          ? `${caption ?? "Confidence"} unavailable`
          : `${caption ?? "Confidence"} ${readout}`
      }
    >
      <svg
        width={size}
        height={Math.round(size * (height / vb))}
        viewBox={`0 0 ${vb} ${height}`}
        className="ioc-stat-gauge-svg"
        aria-hidden="true"
      >
        <defs>
          <linearGradient
            id={`${uid}-fill`}
            x1="4%"
            y1="70%"
            x2="96%"
            y2="18%"
          >
            <stop offset="0%" stopColor={stops.from} />
            <stop offset="52%" stopColor={stops.mid} />
            <stop offset="100%" stopColor={stops.to} />
          </linearGradient>
          <filter
            id={`${uid}-glow`}
            x="-80%"
            y="-80%"
            width="260%"
            height="260%"
          >
            <feGaussianBlur
              in="SourceGraphic"
              stdDeviation="2.8"
              result="blur"
            />
            <feColorMatrix
              in="blur"
              type="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1.1 0"
              result="glow"
            />
            <feMerge>
              <feMergeNode in="glow" />
              <feMergeNode in="glow" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <path
          d={arcPath(cx, cy, radius, GAUGE_START, GAUGE_SWEEP)}
          fill="none"
          stroke="color-mix(in srgb, var(--ioc-kicker) 22%, var(--ioc-glass-border))"
          strokeWidth={stroke}
          strokeLinecap="round"
        />

        {fillSweep > 0.6 ? (
          <path
            d={arcPath(cx, cy, radius, GAUGE_START, fillSweep)}
            fill="none"
            stroke={`url(#${uid}-fill)`}
            strokeWidth={stroke}
            strokeLinecap="round"
            filter={`url(#${uid}-glow)`}
          />
        ) : null}

        {ticks.map((tick) => {
          const tickAngle = GAUGE_START + (tick / 100) * GAUGE_SWEEP;
          const major = tick === 0 || tick === 50 || tick === 100;
          const inner = polar(
            cx,
            cy,
            radius + stroke * 0.72,
            tickAngle,
          );
          const outer = polar(
            cx,
            cy,
            radius + stroke * (major ? 1.35 : 1.05),
            tickAngle,
          );
          return (
            <line
              key={tick}
              x1={fmt(inner.x)}
              y1={fmt(inner.y)}
              x2={fmt(outer.x)}
              y2={fmt(outer.y)}
              stroke="color-mix(in srgb, var(--ioc-text) 42%, transparent)"
              strokeWidth={major ? 1.4 : 1}
              strokeLinecap="round"
            />
          );
        })}

        <line
          x1={cx}
          y1={cy}
          x2={fmt(needle.x)}
          y2={fmt(needle.y)}
          stroke={`url(#${uid}-fill)`}
          strokeWidth="2"
          strokeLinecap="round"
          filter={`url(#${uid}-glow)`}
        />
        <circle
          cx={cx}
          cy={cy}
          r="8.5"
          fill="color-mix(in srgb, var(--ioc-bg) 78%, var(--ioc-glass-bg))"
          stroke={stops.mid}
          strokeWidth="1.8"
          filter={`url(#${uid}-glow)`}
        />
        <circle
          cx={cx}
          cy={cy}
          r="3.2"
          fill="color-mix(in srgb, var(--ioc-bg) 88%, #000)"
        />
        <text
          x={cx}
          y={cy + 34}
          textAnchor="middle"
          fontSize="28"
          className="ioc-stat-gauge-value"
        >
          {readout}
        </text>
      </svg>
    </span>
  );
}

export function StatCounter({
  label,
  value,
  tone = "default",
  size = "md",
  description,
}: {
  label: string;
  value: number;
  tone?: WidgetTone;
  size?: "sm" | "md";
  /** Shown on hover or focus. Omit for counters that need no explanation. */
  description?: ReactNode;
}) {
  const numberClass = size === "sm" ? "text-[22px]" : "text-[28px]";

  const body = (
    <>
      <p className="ioc-kicker">{label}</p>
      <p
        className={`mt-auto pt-2 font-light tabular-nums leading-none ${numberClass} ${valueClass(tone, value)}`}
      >
        {value}
      </p>
    </>
  );

  // Full height with the value pushed to the bottom, so numbers stay on one
  // line across a row even when a longer label wraps onto two.
  if (!description) {
    return <div className="flex h-full flex-col">{body}</div>;
  }

  return (
    // Focusable so the explanation is reachable without a pointer. It stays a
    // plain div rather than a button, since the surrounding card owns the click.
    <div
      className="group relative z-0 flex h-full flex-col hover:z-10 focus-visible:z-10"
      tabIndex={0}
      aria-label={`${label}: ${value}`}
    >
      {body}
      <div
        role="tooltip"
        className="ioc-tooltip pointer-events-none invisible absolute left-0 top-full z-30 mt-2 w-max max-w-[15rem] opacity-0 transition-opacity group-hover:visible group-hover:opacity-100 group-focus-visible:visible group-focus-visible:opacity-100"
      >
        <p className="ioc-copy text-[12px] font-light leading-5">
          {description}
        </p>
      </div>
    </div>
  );
}

export function StatWidget({
  label,
  value,
  description,
  segments = [],
  tone = "default",
  chart = false,
  onClick,
}: {
  label: string;
  value: number;
  description: ReactNode;
  segments?: WidgetSegment[];
  tone?: WidgetTone;
  chart?: boolean;
  onClick?: () => void;
}) {
  const showChart = chart && segments.length > 0;
  // Without a handler the widget is a read-out, so it drops the pointer cursor,
  // the cyan hover and the open affordance.
  const clickable = Boolean(onClick);
  const Tag = clickable ? "button" : "div";

  return (
    <Tag
      type={clickable ? "button" : undefined}
      onClick={onClick}
      aria-label={
        clickable
          ? `${label}: ${value}. ${typeof description === "string" ? description : ""} Click to open.`
          : undefined
      }
      className={`group relative z-0 ioc-glass w-full rounded-xl px-4 py-4 text-left transition-[border-color,box-shadow] ${
        clickable
          ? "cursor-pointer hover:z-10 hover:border-[color:var(--ioc-kicker)] hover:shadow-[0_0_28px_rgba(4,164,202,0.16)] focus-visible:z-10 focus-visible:border-[color:var(--ioc-kicker)]"
          : "hover:z-10"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="ioc-kicker inline-flex items-center gap-1">
            {label}
            {clickable ? (
              <LuArrowUpRight
                size={12}
                className="text-[color:var(--ioc-faint)] transition-colors group-hover:text-[color:var(--ioc-kicker)] group-focus-visible:text-[color:var(--ioc-kicker)]"
                aria-hidden="true"
              />
            ) : null}
          </p>
          <p
            className={`mt-2 font-light tabular-nums leading-none text-[28px] ${valueClass(tone, value)}`}
          >
            {value}
          </p>
        </div>
        {showChart ? <SegmentDonut segments={segments} /> : null}
      </div>

      <div
        role="tooltip"
        className="ioc-tooltip pointer-events-none invisible absolute left-0 top-full z-20 mt-2 opacity-0 transition-opacity group-hover:visible group-hover:opacity-100 group-focus-visible:visible group-focus-visible:opacity-100"
      >
        <p className="ioc-copy text-[12px] font-light leading-5">{description}</p>
        {segments.length > 0 ? (
          <ul className="mt-3 space-y-1.5">
            {segments.map((segment) => (
              <li
                key={segment.label}
                className="flex items-center justify-between gap-6 text-[12px]"
              >
                <span className="inline-flex items-center gap-2">
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ background: segmentStroke(segment.tone) }}
                    aria-hidden="true"
                  />
                  <span className="ioc-copy">{segment.label}</span>
                </span>
                <span
                  className={`tabular-nums ${valueClass(segment.tone ?? "default", segment.value)}`}
                >
                  {segment.value}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </Tag>
  );
}
