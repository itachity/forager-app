type Size = "sm" | "md" | "lg";

const SIZE_MAP: Record<Size, { text: string; icon: number }> = {
  sm: { text: "text-lg", icon: 22 },
  md: { text: "text-2xl", icon: 28 },
  lg: { text: "text-3xl", icon: 36 },
};

export function ForagerLogo({ size = "md" }: { size?: Size }) {
  const { text, icon } = SIZE_MAP[size];
  return (
    <div className="inline-flex items-center gap-2 text-primary">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/icon.png"
        alt=""
        width={icon}
        height={icon}
        style={{ width: icon, height: icon }}
        className="object-contain shrink-0"
      />
      <span className={`${text} font-semibold tracking-tight`}>Forager</span>
    </div>
  );
}
