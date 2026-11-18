import { Link } from "react-router-dom";

export interface Crumb {
  label: string;
  to?: string;
}

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav
      aria-label="Breadcrumb"
      className="flex min-w-0 items-center gap-1.5 text-[13px]"
    >
      {items.map((item, index) => {
        const last = index === items.length - 1;
        return (
          <span
            key={`${item.label}-${index}`}
            className="flex min-w-0 items-center gap-1.5"
          >
            {index > 0 ? (
              <span className="ioc-faint shrink-0" aria-hidden="true">
                /
              </span>
            ) : null}
            {item.to && !last ? (
              <Link
                to={item.to}
                className="truncate text-[color:var(--ioc-muted)] transition-colors hover:text-[color:var(--ioc-fg)]"
              >
                {item.label}
              </Link>
            ) : (
              <span
                className={`truncate ${last ? "ioc-fg font-light" : "ioc-faint"}`}
                aria-current={last ? "page" : undefined}
              >
                {item.label}
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
