import { getCategoryProductsPage } from "@/lib/data/products";

/** GET /api/shop/:category?offset=20 — the next page of a collection for its "Load more" button. */
export async function GET(request: Request, { params }: RouteContext<"/api/shop/[category]">) {
  const { category } = await params;
  const offset = Number(new URL(request.url).searchParams.get("offset") ?? 0);
  if (!/^[a-z0-9-]{1,80}$/.test(category) || !Number.isInteger(offset) || offset < 0 || offset > 10_000) {
    return Response.json({ error: "Bad request" }, { status: 400 });
  }
  return Response.json(await getCategoryProductsPage(category, offset));
}
