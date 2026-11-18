import {
  LuBell,
  LuCircleHelp,
  LuLayoutGrid,
  LuRotateCcw,
  LuSearch,
  LuUser,
} from "react-icons/lu";
import { useEffect } from "react";
import { NavLink } from "react-router-dom";
import { applyTheme, readStoredTheme } from "../utils/theme";

/**
 * The console's mark: three agents with a line to each of the others and a
 * message in flight on every line, which is what the console is about.
 */
function ConsoleMark() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="19"
      height="19"
      aria-hidden
      className="ioc-console-mark"
    >
      <g
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        fill="none"
        opacity="0.65"
      >
        <path d="M12 5.5 L5 17" />
        <path d="M12 5.5 L19 17" />
        <path d="M5 17 L19 17" />
      </g>
      <g fill="currentColor">
        <circle cx="12" cy="5.5" r="3" />
        <circle cx="5" cy="17" r="3" />
        <circle cx="19" cy="17" r="3" />
      </g>
    </svg>
  );
}

/**
 * The shell for the new console: a rail of sections down the side and a bar
 * across the top, sitting beside the demo's original pages rather than
 * inside them, so the two can be worked on without either moving the other.
 */
export function ConsoleShell({
  search,
  onSearch,
  children,
}: {
  /** Where given, the bar carries a search field wired to it. */
  search?: string;
  onSearch?: (value: string) => void;
  children: React.ReactNode;
}) {
  // The console is drawn dark and only dark, whatever the demo's pages are
  // set to; whatever that setting was comes back on the way out.
  useEffect(() => {
    applyTheme("dark");
    return () => applyTheme(readStoredTheme());
  }, []);

  return (
    <div className="ioc-shell flex min-h-screen flex-col">
      <header className="ioc-console-bar sticky top-0 z-[60] flex h-[52px] shrink-0 items-center gap-4 px-4">
        <NavLink to="/console" className="ioc-console-brand">
          <ConsoleMark />
          IOC
        </NavLink>

        <div className="ioc-console-bar-split" aria-hidden />

        <label className="ioc-console-search">
          <LuSearch size={14} aria-hidden />
          <input
            type="search"
            value={search ?? ""}
            onChange={(event) => onSearch?.(event.target.value)}
            placeholder="Search"
            aria-label="Search"
            disabled={!onSearch}
          />
        </label>

        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            className="ioc-icon-btn"
            aria-label="Reset the demo"
            title="Reset the demo: drops protocols, blocks and investigations run from these pages"
            onClick={() => window.location.assign(window.location.pathname)}
          >
            <LuRotateCcw size={15} />
          </button>
          <button type="button" className="ioc-icon-btn" aria-label="Help">
            <LuCircleHelp size={15} />
          </button>
          <button
            type="button"
            className="ioc-icon-btn"
            aria-label="Notifications"
          >
            <LuBell size={15} />
          </button>
          <button type="button" className="ioc-icon-btn" aria-label="Account">
            <LuUser size={15} />
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <nav className="ioc-console-rail" aria-label="Sections">
          <NavLink
            to="/console"
            end
            title="Applications"
            aria-label="Applications"
            className={({ isActive }) =>
              `ioc-console-rail-link${isActive ? " is-active" : ""}`
            }
          >
            <LuLayoutGrid size={17} />
          </NavLink>
        </nav>

        <main className="flex min-w-0 flex-1 flex-col">
          {/* The same measure the rest of the demo is read at, so the three
              columns come out the width they do on an investigation. */}
          <div className="mx-auto flex w-full max-w-[1390px] flex-col p-6 xl:max-w-[1680px] 2xl:max-w-[1920px]">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
