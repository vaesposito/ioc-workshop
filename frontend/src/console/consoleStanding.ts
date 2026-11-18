import { useSyncExternalStore } from "react";

/**
 * What the reader has done to the console since the demo was last reset:
 * the investigations run, the controls taken off the back of them, and the
 * protocols put on. The pages are invented and there is nothing behind them
 * to write to, so it is held here instead — across pages, so a control
 * taken on a session is still in force when the application is opened
 * again, and dropped by the reset in the top bar.
 */

export type Standing = "open" | "held" | "let";

/** One investigation that was run from these pages. */
export interface LookedSession {
  app: string;
  session: string;
  verdict: "malicious" | "clean";
}

/** One recommendation that was answered, either way. */
export interface TakenMove {
  app: string;
  session: string;
  move: string;
  standing: Exclude<Standing, "open">;
  /** How it reads once taken: "Calls to Order Book blocked". */
  label: string;
}

export interface ConsoleStanding {
  looked: LookedSession[];
  taken: TakenMove[];
  /** The protocols on each application, where the reader has changed them. */
  protocols: Record<string, string[]>;
}

const KEY = "ioc-console-standing";
const EMPTY: ConsoleStanding = { looked: [], taken: [], protocols: {} };

function readStored(): ConsoleStanding {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const held = JSON.parse(raw) as Partial<ConsoleStanding>;
    return {
      looked: held.looked ?? [],
      taken: held.taken ?? [],
      protocols: held.protocols ?? {},
    };
  } catch {
    return EMPTY;
  }
}

let standing = readStored();
const watchers = new Set<() => void>();

function put(next: ConsoleStanding) {
  standing = next;
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // A demo with no storage to write to still works for the one page.
  }
  for (const watch of watchers) watch();
}

function subscribe(watch: () => void) {
  watchers.add(watch);
  return () => {
    watchers.delete(watch);
  };
}

export function useConsoleStanding(): ConsoleStanding {
  return useSyncExternalStore(
    subscribe,
    () => standing,
    () => EMPTY,
  );
}

/** Remember that an investigation was run, and what it came back with. */
export function rememberLook(entry: LookedSession) {
  if (
    standing.looked.some(
      (held) => held.app === entry.app && held.session === entry.session,
    )
  ) {
    return;
  }
  put({ ...standing, looked: [...standing.looked, entry] });
}

/** Take a recommendation one way or the other, or put it back as it was. */
export function settleMove(
  entry: Omit<TakenMove, "standing"> & { standing: Standing },
) {
  const rest = standing.taken.filter(
    (held) =>
      !(
        held.app === entry.app &&
        held.session === entry.session &&
        held.move === entry.move
      ),
  );
  put({
    ...standing,
    taken:
      entry.standing === "open"
        ? rest
        : [...rest, { ...entry, standing: entry.standing }],
  });
}

/** The protocols on an application, as the reader last left them. */
export function setProtocols(app: string, codes: string[]) {
  put({ ...standing, protocols: { ...standing.protocols, [app]: codes } });
}

/** Put the console back to how it was found. */
export function resetConsole() {
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    // Nothing stored, nothing to drop.
  }
  put(EMPTY);
}

/** How each recommendation on one session stands, as the panel reads it. */
export function standingOn(
  taken: TakenMove[],
  app: string,
  session: string,
): Record<string, Standing> {
  const held: Record<string, Standing> = {};
  for (const entry of taken) {
    if (entry.app === app && entry.session === session) {
      held[entry.move] = entry.standing;
    }
  }
  return held;
}
