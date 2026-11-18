type ActionButtonVariant = "primary" | "secondary" | "text";

const Button = ({
  text,
  variant,
  children,
  type = "button",
  onClick,
}: {
  text: string;
  variant: ActionButtonVariant;
  children?: React.ReactNode;
  type?: "button" | "submit" | "reset";
  onClick?: () => void;
}) => {
  const variantClassName =
    variant === "secondary"
      ? "ioc-btn-ghost px-2.5 py-1"
      : variant === "text"
        ? "text-xs font-light tracking-wide text-[#04A4CA] hover:text-[#7ddcf0] transition-colors"
        : "ioc-btn-primary px-2.5 py-1";

  return (
    <button
      type={type}
      className={`cursor-pointer flex items-center gap-1 ${variantClassName}`}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
    >
      {children}
      {variant === "text" ? (
        <span className="font-light tracking-[0.08em] uppercase">{text}</span>
      ) : (
        <span className="whitespace-nowrap">{text}</span>
      )}
    </button>
  );
};

export { Button };
