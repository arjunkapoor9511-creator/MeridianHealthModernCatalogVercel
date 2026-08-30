// ---------------------------------------------------------------------------
// POST-less demo login: GET /api/demo-login?persona=<modern-mark|legacy-luke>
// ---------------------------------------------------------------------------
// Stands in for a real IdP handshake. The MeridianHealth storefront links here
// from its "Browse Our Catalog" modal. We:
//   1. map the persona query param to a known identity (see PERSONAS below),
//   2. mint a signed session JWT,
//   3. set it as the mm_session cookie,
//   4. 302-redirect to "/" where proxy.ts takes over.
//
// This route is reachable WITHOUT a session because proxy.ts's matcher excludes
// "/api" - that exclusion is what stops the gate from deadlocking (you can't get
// a session without first hitting the endpoint that issues one).
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  createSessionToken,
  type SessionClaims,
} from "@/lib/session";

// DEMO DATA - deliberately hard-coded here.
// TALKING POINT: in production this lookup is a call to a member/eligibility
// service, keyed by the user who ALREADY authenticated on the storefront. The
// persona param would instead be a verified identity handoff, and `insurance`
// would come back fresh from the system of record (it can change when a member
// switches plans), not be trusted from the caller.
const PERSONAS: Record<string, SessionClaims> = {
  "modern-mark": {
    sub: "UHC-44107",
    name: "Modern Mark",
    insurance: "unitedhealthcare",
  },
  "legacy-luke": {
    sub: "HUM-20938",
    name: "Legacy Luke",
    insurance: "humana",
  },
};

export async function GET(request: NextRequest): Promise<Response> {
  const personaKey = request.nextUrl.searchParams.get("persona");
  const claims = personaKey ? PERSONAS[personaKey] : undefined;

  if (!claims) {
    return new NextResponse(
      "Unknown or missing persona. Try ?persona=modern-mark or ?persona=legacy-luke",
      { status: 400 },
    );
  }

  const token = await createSessionToken(claims);

  // Redirect against nextUrl.origin (not request.url) so this still resolves
  // correctly if the storefront ever reverse-proxies us under another domain.
  const res = NextResponse.redirect(new URL("/", request.nextUrl.origin), {
    status: 302,
  });

  res.cookies.set({
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true, // not readable from JS
    sameSite: "lax", // sent on the top-level GET navigation that follows the 302
    path: "/",
    maxAge: SESSION_TTL_SECONDS, // matches the token's exp
    // Secure would break http://localhost during `next dev`; enable it in prod.
    secure: process.env.NODE_ENV === "production",
  });

  return res;
}
