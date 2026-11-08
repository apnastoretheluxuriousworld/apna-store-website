import { getStoreCategories } from "@/lib/data/categories";
import { searchStoreProducts } from "@/lib/data/products";
import { cleanQuery, matchCollections, type SearchResult } from "@/lib/search";

/** GET /api/search?q= — live search for the storefront search page (results are cached per query). */
export async function GET(request: Request) {
  const q = cleanQuery(new URL(request.url).searchParams.get("q"));
  if (!q) return Response.json({ q, collections: [], products: [] } satisfies SearchResult);
  const [categories, products] = await Promise.all([getStoreCategories(), searchStoreProducts(q)]);
  return Response.json({ q, collections: matchCollections(categories, q), products } satisfies SearchResult);
}
