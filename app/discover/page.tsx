"use client";

import { useMemo } from "react";
import { AppHeader } from "@/components/forager/AppHeader";
import { BottomNav } from "@/components/forager/BottomNav";
import { DiscoverCard, type DiscoverItem } from "@/components/forager/DiscoverCard";
import { FOOD_IMAGES } from "@/lib/forager-fallback";
import { useUserGeo, formatDistanceMi, haversineMiles } from "@/lib/forager-geo";

/* Curated demo dataset around Corvallis, OR (OSU). lat/lng lets us compute
 * a real distance to the user when geolocation is granted. */
const ITEMS: DiscoverItem[] = [
  {
    id: "1",
    name: "Green Harvest Bowl",
    cuisine: "Local Boys Grindz · Hawaiian",
    address: "150 SW Madison Ave, Corvallis, OR",
    lat: 44.5635,
    lng: -123.2620,
    imageUrl: FOOD_IMAGES.bowl,
    rating: 4.8,
    reasonChip: "Top pick",
    tags: ["High protein", "Under $14"],
    priceLabel: "$$",
  },
  {
    id: "2",
    name: "Tonkotsu Ramen",
    cuisine: "Mio Sushi · Japanese",
    address: "215 SW 2nd St, Corvallis, OR",
    lat: 44.5641,
    lng: -123.2604,
    imageUrl: FOOD_IMAGES.ramen,
    rating: 4.6,
    reasonChip: "Cozy",
    tags: ["Comfort", "Late-night"],
    priceLabel: "$$",
  },
  {
    id: "3",
    name: "Truffle Mushroom Pizza",
    cuisine: "American Dream · Italian",
    address: "214 SW 2nd St, Corvallis, OR",
    lat: 44.5642,
    lng: -123.2603,
    imageUrl: FOOD_IMAGES.pizza,
    rating: 4.7,
    reasonChip: "Treat",
    tags: ["Vegetarian", "Shareable"],
    priceLabel: "$$$",
  },
  {
    id: "4",
    name: "Spicy Pho Ga",
    cuisine: "Pho Van · Vietnamese",
    address: "151 NW Monroe Ave, Corvallis, OR",
    lat: 44.5644,
    lng: -123.2630,
    imageUrl: FOOD_IMAGES.noodles,
    rating: 4.5,
    reasonChip: "Light",
    tags: ["Soup", "Lean protein"],
    priceLabel: "$",
  },
  {
    id: "5",
    name: "Carnitas Tacos",
    cuisine: "Burrito Amigos · Mexican",
    address: "133 NW 2nd St, Corvallis, OR",
    lat: 44.5651,
    lng: -123.2606,
    imageUrl: FOOD_IMAGES.taco,
    rating: 4.4,
    reasonChip: "Cheap eats",
    tags: ["Under $10", "Quick"],
    priceLabel: "$",
  },
  {
    id: "6",
    name: "Salmon Poke Bowl",
    cuisine: "Koriente · Hawaiian",
    address: "1425 NW Monroe Ave, Corvallis, OR",
    lat: 44.5673,
    lng: -123.2728,
    imageUrl: FOOD_IMAGES.poke,
    rating: 4.7,
    reasonChip: "Healthy",
    tags: ["High protein", "Low carb"],
    priceLabel: "$$",
  },
];

export default function DiscoverPage() {
  const geo = useUserGeo();
  const items = useMemo<DiscoverItem[]>(() => {
    if (!geo) return ITEMS.map((item) => ({ ...item }));
    return ITEMS.map((item) => {
      if (item.lat == null || item.lng == null) return item;
      const miles = haversineMiles(geo.lat, geo.lng, item.lat, item.lng);
      return { ...item, distance: formatDistanceMi(miles) };
    }).sort((a, b) => parseDist(a.distance) - parseDist(b.distance));
  }, [geo]);

  return (
    <main className="min-h-screen pb-32">
      <AppHeader />
      <div className="max-w-xl mx-auto px-5 pt-2">
        <p className="text-sm text-muted-foreground text-center mb-5">
          {geo ? "Curated finds near you" : "Curated finds — turn on location for accurate distances"}
        </p>

        <div className="grid grid-cols-2 gap-3">
          {items.map((item) => (
            <DiscoverCard key={item.id} item={item} />
          ))}
        </div>
      </div>
      <BottomNav />
    </main>
  );
}

function parseDist(s?: string): number {
  if (!s) return Number.POSITIVE_INFINITY;
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : Number.POSITIVE_INFINITY;
}
