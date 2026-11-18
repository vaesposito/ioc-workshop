import type { IconType } from "react-icons";
import { LuBot } from "react-icons/lu";
import { SiAnthropic, SiGooglegemini, SiOpenai } from "react-icons/si";
import { describeModel, type ModelVendor } from "../utils/modelBadge";

export function vendorIcon(vendor: ModelVendor): IconType {
  switch (vendor) {
    case "openai":
      return SiOpenai;
    case "google":
      return SiGooglegemini;
    case "anthropic":
      return SiAnthropic;
    default:
      return LuBot;
  }
}

export function modelIconFor(model: string): IconType {
  return vendorIcon(describeModel(model).vendor);
}

/** The maker's logo in a round chip, sized for a list row. */
export function ModelMark({ model, size = 13 }: { model: string; size?: number }) {
  const badge = describeModel(model);
  const Icon = vendorIcon(badge.vendor);
  return (
    <span
      className="ioc-agent-mark"
      title={`${badge.name} · ${badge.host}`}
      aria-hidden="true"
    >
      <Icon size={size} />
    </span>
  );
}
