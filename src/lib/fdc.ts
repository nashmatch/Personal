// Public USDA FoodData Central API client.
// Docs: https://fdc.nal.usda.gov/api-guide.html
// Free API key: https://fdc.nal.usda.gov/api-key-signup.html
// Falls back to the shared DEMO_KEY (tightly rate-limited) when FDC_API_KEY is unset.

const FDC_BASE = "https://api.nal.usda.gov/fdc/v1";

export interface FdcFoodResult {
  fdcId: number;
  name: string;
  brand?: string;
  servingQty: number;
  servingUnit: string;
  gramsPerServing: number;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG?: number;
  sugarG?: number;
  sodiumMg?: number;
}

interface FdcNutrient {
  nutrientId?: number;
  nutrient?: { id?: number };
  value?: number;
  amount?: number;
}

interface FdcApiFood {
  fdcId: number;
  description: string;
  brandName?: string;
  brandOwner?: string;
  servingSize?: number;
  servingSizeUnit?: string;
  foodNutrients?: FdcNutrient[];
}

const NUTRIENT_IDS = {
  ENERGY: 1008,
  PROTEIN: 1003,
  FAT: 1004,
  CARBS: 1005,
  FIBER: 1079,
  SUGAR: 2000,
  SODIUM: 1093,
};

function apiKey() {
  return process.env.FDC_API_KEY || "DEMO_KEY";
}

function extractNutrient(foodNutrients: FdcNutrient[], nutrientId: number): number | undefined {
  const match = foodNutrients?.find(
    (n) => n.nutrientId === nutrientId || n.nutrient?.id === nutrientId,
  );
  if (!match) return undefined;
  return match.value ?? match.amount;
}

function mapFdcFood(item: FdcApiFood): FdcFoodResult {
  const nutrients = item.foodNutrients ?? [];
  const gramsPerServing = item.servingSize && item.servingSizeUnit === "g" ? item.servingSize : 100;
  return {
    fdcId: item.fdcId,
    name: item.description,
    brand: item.brandName || item.brandOwner || undefined,
    servingQty: 1,
    servingUnit: item.servingSizeUnit ? `${item.servingSize ?? 100}${item.servingSizeUnit}` : "100g",
    gramsPerServing,
    calories: extractNutrient(nutrients, NUTRIENT_IDS.ENERGY) ?? 0,
    proteinG: extractNutrient(nutrients, NUTRIENT_IDS.PROTEIN) ?? 0,
    carbsG: extractNutrient(nutrients, NUTRIENT_IDS.CARBS) ?? 0,
    fatG: extractNutrient(nutrients, NUTRIENT_IDS.FAT) ?? 0,
    fiberG: extractNutrient(nutrients, NUTRIENT_IDS.FIBER),
    sugarG: extractNutrient(nutrients, NUTRIENT_IDS.SUGAR),
    sodiumMg: extractNutrient(nutrients, NUTRIENT_IDS.SODIUM),
  };
}

export async function searchFdcFoods(query: string, pageSize = 15): Promise<FdcFoodResult[]> {
  if (!query.trim()) return [];
  try {
    const url = new URL(`${FDC_BASE}/foods/search`);
    url.searchParams.set("api_key", apiKey());
    url.searchParams.set("query", query);
    url.searchParams.set("pageSize", String(pageSize));
    url.searchParams.set("dataType", "Foundation,SR Legacy,Branded");

    const res = await fetch(url.toString(), { next: { revalidate: 0 } });
    if (!res.ok) {
      console.warn(`FDC search failed: ${res.status}`);
      return [];
    }
    const data = (await res.json()) as { foods?: FdcApiFood[] };
    const foods = data.foods ?? [];
    return foods.map(mapFdcFood).filter((f) => f.calories > 0);
  } catch (err) {
    console.warn("FDC search error", err);
    return [];
  }
}
