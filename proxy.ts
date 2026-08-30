// ---------------------------------------------------------------------------
// proxy.ts  (Next.js 16 renamed "middleware" -> "proxy"; file lives at repo root)
// ---------------------------------------------------------------------------
// Runs before every page render (see `config.matcher`). Its job in this demo:
//
//   1. Read + verify the mm_session cookie.
//   2. No / invalid session  -> 302 back to the MeridianHealth storefront.
//   3. Valid session         -> strip any client-supplied x-user-* headers,
//                               set the VERIFIED insurance / sub / name as
//                               request headers, and continue to the app.
//
// The homepage (app/page.tsx) then reads x-user-insurance to decide which
// insurance cohort's products to fetch.
//
// FUTURE (strangler-fig): when a cohort has NOT yet been migrated, rewrite the
// request to the legacy origin instead of continuing. That branch is stubbed
// out below until the legacy fork exists.
//
// Runtime note: in Next.js 16 proxy runs on the Node.js runtime only, so `jose`
// (used by verifySessionToken) works here without an edge-compatible build.
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";

export const config = {
  // Run on everything EXCEPT:
  //   - /api/*          (so /api/demo-login is reachable without a session)
  //   - /_next/static/* , /_next/image/*  (build assets)
  //   - /favicon.ico
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};

// Used only if MARKETPLACE_ENTRY_URL is unset, so a missing env var can't crash
// the proxy or cause a redirect loop.
const FALLBACK_ENTRY = "https://meridianhealth.example/";

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

  // --- FUTURE: route not-yet-migrated cohorts to the legacy fork ------------
  // const MIGRATED: string[] = ["unitedhealthcare"]; // flip cohorts on here
  // if (!MIGRATED.includes(claims.insurance)) {
  //   return NextResponse.rewrite(
  //     new URL(
  //       request.nextUrl.pathname + request.nextUrl.search,
  //       process.env.LEGACY_ORIGIN!,
  //     ),
  //   );
  // }
  // For now: BOTH unitedhealthcare and humana render on this app.

  // --- Signed in -> forward verified identity to the render ----------------
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
