import { useQuery } from "@tanstack/react-query";
import { LuEye, LuEyeOff } from "react-icons/lu";
import { Layout } from "../components/Layout";
import { appVisibilityStore, useHiddenAppIds } from "../cms/appVisibility";
import { cmsRepository } from "../cms/repository";
import { getApplicationCopy } from "../content/application-copy";

export function AppSettings() {
  const hidden = useHiddenAppIds();
  const { data: apps = [], isLoading } = useQuery({
    queryKey: ["applications", "all"],
    queryFn: cmsRepository.listAllApplications,
  });

  const sorted = [...apps].sort((left, right) =>
    left.name.localeCompare(right.name),
  );
  const visibleCount = sorted.filter((app) => !hidden.has(app.id)).length;

  return (
    <Layout pageTitle="App settings">
      <div className="flex flex-col gap-8 py-2">
        <div className="max-w-3xl">
          <h1 className="ioc-title text-3xl md:text-4xl">App settings</h1>
          <p className="ioc-copy mt-3 max-w-2xl text-[15px]">
            Choose which applications appear across every view. Hiding an
            application also removes its investigations and traces from the
            overview, application list, investigations, and navigation. This
            preference is saved in this browser only.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="ioc-btn-ghost"
            onClick={() => appVisibilityStore.reset()}
          >
            <LuEye size={14} />
            Show all
          </button>
          <button
            type="button"
            className="ioc-btn-ghost"
            onClick={() =>
              appVisibilityStore.setHiddenIds(sorted.map((app) => app.id))
            }
          >
            <LuEyeOff size={14} />
            Hide all
          </button>
          <span className="ioc-copy text-[13px]">
            {visibleCount} of {sorted.length} shown
          </span>
        </div>

        {isLoading ? (
          <div className="ioc-glass rounded-xl px-6 py-12 text-center">
            <p className="ioc-copy text-[14px]">Loading applications…</p>
          </div>
        ) : sorted.length === 0 ? (
          <div className="ioc-glass rounded-xl px-6 py-12 text-center">
            <p className="ioc-copy text-[14px]">No applications available.</p>
          </div>
        ) : (
          <ul className="ioc-glass divide-y divide-[color:var(--ioc-glass-border)] overflow-hidden rounded-xl">
            {sorted.map((app) => {
              const isVisible = !hidden.has(app.id);
              return (
                <li
                  key={app.id}
                  className="flex items-center justify-between gap-4 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="ioc-title text-[15px]">{app.name}</p>
                    <p className="ioc-copy truncate text-[13px]">
                      {getApplicationCopy(app)?.shortDescription ??
                        app.description}
                    </p>
                  </div>
                  <label className="ioc-copy flex shrink-0 cursor-pointer select-none items-center gap-2 text-[13px]">
                    <span>{isVisible ? "Shown" : "Hidden"}</span>
                    <input
                      type="checkbox"
                      checked={isVisible}
                      onChange={(event) =>
                        appVisibilityStore.setVisible(
                          app.id,
                          event.target.checked,
                        )
                      }
                      className="h-4 w-4 cursor-pointer accent-[color:var(--ioc-kicker)]"
                    />
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Layout>
  );
}
