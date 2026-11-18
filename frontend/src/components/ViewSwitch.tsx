/**
 * Two ways of reading the same page, side by side in the chrome. The pages
 * keep the choice in the URL, so a view can be linked to and survives a
 * reload rather than resetting to whichever one is the default.
 */
export function ViewSwitch<Value extends string>({
  label = "View",
  value,
  options,
  onChange,
}: {
  label?: string;
  value: Value;
  options: { value: Value; label: string }[];
  onChange: (value: Value) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <p className="ioc-kicker">{label}</p>
      <div className="flex items-center gap-1.5">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={value === option.value}
            className={`ioc-round-chip${value === option.value ? " is-active" : ""}`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
