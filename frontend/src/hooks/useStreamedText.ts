import { useEffect, useRef, useState } from "react";

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// Progressively reveals `text` word-by-word to mimic live streaming.
export function useStreamedText(
  text: string,
  { enabled = true, wordsPerTick = 2, intervalMs = 45 }: {
    enabled?: boolean;
    wordsPerTick?: number;
    intervalMs?: number;
  } = {},
): { text: string; done: boolean } {
  const [count, setCount] = useState(0);
  const words = useRef<string[]>([]);

  words.current = text.length > 0 ? text.split(/(\s+)/) : [];
  const total = words.current.length;

  useEffect(() => {
    if (!enabled || prefersReducedMotion() || total === 0) {
      setCount(total);
      return;
    }
    setCount(0);
    const id = window.setInterval(() => {
      setCount((current) => {
        const next = current + wordsPerTick * 2;
        if (next >= total) {
          window.clearInterval(id);
          return total;
        }
        return next;
      });
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [text, enabled, total, wordsPerTick, intervalMs]);

  const revealed = words.current.slice(0, count).join("");
  return { text: revealed, done: count >= total };
}
