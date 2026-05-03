import { Leaf } from "lucide-react";

type Size = "sm" | "md" | "lg";

const SIZE_MAP: Record<Size, { text: string; icon: number }> = {
  sm: { text: "text-lg", icon: 18 },
  md: { text: "text-2xl", icon: 22 },
  lg: { text: "text-3xl", icon: 28 },
};

export function ForagerLogo({ size = "md" }: { size?: Size }) {
  const { text, icon } = SIZE_MAP[size];
  return (
    <div className="inline-flex items-center gap-2 text-primary">
      <Leaf size={icon} strokeWidth={2.2} className="-rotate-12" />
      <span className={`${text} font-semibold tracking-tight`}>Forager</span>
    </div>
  );
}
