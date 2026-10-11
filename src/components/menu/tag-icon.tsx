import {
  BadgeCheck,
  Carrot,
  ChefHat,
  CircleDot,
  Egg,
  Leaf,
  Milk,
  Nut,
  Tag,
  Wheat,
  WheatOff,
  type LucideIcon,
} from "lucide-react";

// Explicit map (not a dynamic import of all icons) keeps the bundle small.
const icons: Record<string, LucideIcon> = {
  leaf: Leaf,
  carrot: Carrot,
  "badge-check": BadgeCheck,
  "wheat-off": WheatOff,
  "chef-hat": ChefHat,
  nut: Nut,
  milk: Milk,
  wheat: Wheat,
  egg: Egg,
  "circle-dot": CircleDot,
};

export function TagIcon({
  name,
  className,
}: {
  name: string | null;
  className?: string;
}) {
  const Icon = (name && icons[name]) || Tag;
  return <Icon aria-hidden="true" className={className} />;
}
