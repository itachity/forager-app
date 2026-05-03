import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

export function AllergenFlag({
  allergen,
  className,
}: {
  allergen: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-destructive/10 text-destructive px-2.5 py-1 text-xs font-semibold",
        className
      )}
    >
      <AlertTriangle size={12} /> {allergen}
    </span>
  );
}

/**
 * Returns the user allergens that intersect a list of ingredients.
 * Case-insensitive substring match on either side.
 */
export function intersectAllergens(allergens: string[], ingredients: string[]): string[] {
  const lowered = ingredients.map((i) => i.toLowerCase());
  return allergens.filter((a) => {
    const al = a.toLowerCase();
    return lowered.some((ing) => ing.includes(al) || al.includes(ing));
  });
}
