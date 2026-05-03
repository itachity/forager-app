"use client";

import { ForagerLogo } from "@/components/forager/ForagerLogo";
import { BottomNav } from "@/components/forager/BottomNav";
import { DiscoverCard, type DiscoverItem } from "@/components/forager/DiscoverCard";
import { FOOD_IMAGES } from "@/lib/forager-fallback";

const ITEMS: DiscoverItem[] = [
  {
    id: "1",
    name: "Green Harvest Bowl",
    cuisine: "Local Boys Grindz · Hawaiian",
    imageUrl: FOOD_IMAGES.bowl,
    rating: 4.8,
    reasonChip: "Top pick",
    tags: ["High protein", "Under $14"],
    priceLabel: "$$",
    distance: "0.3 mi",
  },
  {
    id: "2",
    name: "Tonkotsu Ramen",
    cuisine: "Mio Sushi · Japanese",
    imageUrl: FOOD_IMAGES.ramen,
    rating: 4.6,
    reasonChip: "Cozy",
    tags: ["Comfort", "Late-night"],
    priceLabel: "$$",
    distance: "0.6 mi",
  },
  {
    id: "3",
    name: "Truffle Mushroom Pizza",
    cuisine: "American Dream · Italian",
    imageUrl: FOOD_IMAGES.pizza,
    rating: 4.7,
    reasonChip: "Treat",
    tags: ["Vegetarian", "Shareable"],
    priceLabel: "$$$",
    distance: "0.9 mi",
  },
  {
    id: "4",
    name: "Spicy Pho Ga",
    cuisine: "Pho Van · Vietnamese",
    imageUrl: FOOD_IMAGES.noodles,
    rating: 4.5,
    reasonChip: "Light",
    tags: ["Soup", "Lean protein"],
    priceLabel: "$",
    distance: "0.4 mi",
  },
  {
    id: "5",
    name: "Carnitas Tacos",
    cuisine: "Burrito Amigos · Mexican",
    imageUrl: FOOD_IMAGES.taco,
    rating: 4.4,
    reasonChip: "Cheap eats",
    tags: ["Under $10", "Quick"],
    priceLabel: "$",
    distance: "0.5 mi",
  },
  {
    id: "6",
    name: "Salmon Poke Bowl",
    cuisine: "Koriente · Hawaiian",
    imageUrl: FOOD_IMAGES.poke,
    rating: 4.7,
    reasonChip: "Healthy",
    tags: ["High protein", "Low carb"],
    priceLabel: "$$",
    distance: "0.7 mi",
  },
];

export default function DiscoverPage() {
  return (
    <main className="min-h-screen pb-32">
      <div className="max-w-xl mx-auto px-5 pt-6">
        <div className="flex flex-col items-center text-center mb-5">
          <ForagerLogo size="lg" />
          <p className="text-sm text-muted-foreground mt-1">
            Curated finds near you
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {ITEMS.map((item) => (
            <DiscoverCard key={item.id} item={item} />
          ))}
        </div>
      </div>
      <BottomNav />
    </main>
  );
}
