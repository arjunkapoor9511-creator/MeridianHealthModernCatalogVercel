// ---------------------------------------------------------------------------
// GET /api/product-detail/<sku>
// ---------------------------------------------------------------------------
// Serves the normalised `ProductDetail` the popup streams in after its shell
// paints. `/api/*` is excluded from proxy.ts's session gate, so we verify the
// mm_session cookie here for parity with the rest of the app (and so an anon
// visitor can't enumerate the catalogue).
//
// The upstream Azure call + secret live in `getProductDetail` (`use cache`), so
// this handler stays a thin auth + shaping layer. The response also carries a
// CDN Cache-Control header for shared caching in front of the function.
// ---------------------------------------------------------------------------

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { getProductDetail } from "@/lib/products";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ sku: string }> },
) {
  const { sku } = await params;

  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!(await verifySessionToken(token))) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const detail = await getProductDetail(sku);
  if (!detail) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json(detail, {
    headers: {
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
