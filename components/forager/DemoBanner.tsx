import { Info } from "lucide-react";

export function DemoBanner({ message }: { message?: string }) {
  return (
    <div className="rounded-2xl bg-accent-soft text-accent border border-accent/20 px-4 py-2 text-xs font-semibold flex items-center gap-2">
      <Info size={14} />
      {message ?? "Demo data — backend offline. The flow still works end-to-end."}
    </div>
  );
}
