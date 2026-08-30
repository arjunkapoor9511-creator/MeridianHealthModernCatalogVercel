// ---------------------------------------------------------------------------
// proxy.ts  (Next.js 16 renamed "middleware" -> "proxy"; file lives at repo root)
// ---------------------------------------------------------------------------
// The strangler-fig router for the demo. Runs before every page render:
//
//   1. Read + verify the mm_session cookie.
//   2. No / invalid session   -> 302 back to the MeridianHealth storefront.
//   3. Signed in, destination "legacy"  -> transparent rewrite to the legacy
//                                          fork (browser URL stays on this domain).
//   4. Signed in, destination "modern"  -> continue to this app, injecting the
//                                          verified x-user-* headers.
//
// The modern/legacy decision comes from lib/routing.ts, which reads the routing
// table from Vercel Global Config so cohorts can be cut over / rolled back with
// NO redeploy (scripts/cohort.mjs).
//
// Runtime note: in Next.js 16 proxy runs on the Node.js runtime only, so `jose`
// and `@vercel/global-config` work here without an edge-compatible build.
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";
import { resolveDestination } from "@/lib/routing";

export const config = {
  // Run on everything EXCEPT:
  //   - /api/*          (so /api/demo-login is reachable without a session)
  //   - /_next/static/* , /_next/image/*  (build assets)
  //   - /favicon.ico
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};

// Fallbacks so a missing env var can't crash the proxy or cause a redirect loop.
const FALLBACK_ENTRY = "https://meridianhealth.example/";
const FALLBACK_LEGACY = "https://meridianlegacy.z13.web.core.windows.net";

export async function proxy(request: NextRequest): Promise<Response> {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const claims = await verifySessionToken(token);

  // --- Not signed in -> back to the storefront front door -------------------
  if (!claims) {
    const entry = process.env.MARKETPLACE_ENTRY_URL ?? FALLBACK_ENTRY;
    // NextResponse.redirect needs an absolute URL. The storefront is a
    // different origin, so this cannot re-trigger this proxy (no loop).
    return NextResponse.redirect(new URL(entry), { status: 302 });
  }

  const destination = await resolveDestination(claims.insurance, claims.sub);

  // One structured log line per request so you can watch the split land and
  // correlate a spike with the cohort during a cutover.
  console.log(
    JSON.stringify({
      at: "proxy",
      sub: claims.sub,
      insurance: claims.insurance,
      destination,
    }),
  );

  // --- destination "legacy" -> transparently serve the legacy fork ---------
  if (destination === "legacy") {
    const legacyOrigin = process.env.LEGACY_ORIGIN ?? FALLBACK_LEGACY;
    // rewrite (not redirect): the browser URL stays on this domain; Next
    // proxies the legacy origin's response. In a real strangler we would also
    // inject a short-lived signed x-auth-assertion header here for the legacy
    // app to verify - the static blob site ignores request headers, so we skip
    // it for the demo.
    return NextResponse.rewrite(
      new URL(request.nextUrl.pathname + request.nextUrl.search, legacyOrigin),
    );
  }

  // --- destination "modern" -> forward verified identity to the render -----
  const requestHeaders = new Headers(request.headers);
  // Never trust x-user-* from the client; overwrite with verified values.
  requestHeaders.delete("x-user-insurance");
  requestHeaders.delete("x-user-sub");
  requestHeaders.delete("x-user-name");
  requestHeaders.set("x-user-insurance", claims.insurance);
  requestHeaders.set("x-user-sub", claims.sub);
  requestHeaders.set("x-user-name", claims.name);

  // `request: { headers }` -> visible to the rendered route only, NOT the client.
  return NextResponse.next({ request: { headers: requestHeaders } });
}
