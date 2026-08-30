// ---------------------------------------------------------------------------
// Demo session token
// ---------------------------------------------------------------------------
// This module mints and verifies the first-party session that moderncatalog
// (the "Modern Marketplace") issues after a user picks a demo persona on the
// MeridianHealth storefront.
//
// Shape of the demo:
//   storefront persona link
//     -> GET /api/demo-login?persona=...      (app/api/demo-login/route.ts)
//        -> createSessionToken()  -> Set-Cookie: mm_session=<JWT>  -> 302 /
//     -> proxy.ts reads the cookie -> verifySessionToken() -> injects x-user-* headers
//     -> app/page.tsx reads x-user-insurance
//
// PRODUCTION HARDENING (intentionally NOT done here - this is a demo):
//   * HS256 signing means anyone holding SESSION_SECRET can mint a valid
//     session. That is fine when a single app both signs and verifies. In
//     production, where the storefront/IdP signs and moderncatalog only
//     verifies, use asymmetric signing (EdDSA/RS256) or an encrypted JWE
//     (`dir` + A256GCM) so the other side holds only a public / encryption key.
//   * Add `aud` (bind the token to this app), `jti` (single-use / replay
//     tracking), a short TTL with a refresh flow, and DB-backed revocation.
//   * Do not freeze the insurance provider into the token - read it fresh from
//     a member/eligibility service, since a member's plan can change.
// ---------------------------------------------------------------------------

import { SignJWT, jwtVerify } from "jose";

/** Name of the cookie that carries the signed session JWT. */
export const SESSION_COOKIE = "mm_session";

/** Token lifetime. Also used as the cookie Max-Age so the two expire together. */
export const SESSION_TTL_SECONDS = 60 * 60 * 8; // 8 hours

/** `iss` claim - checked on verify so tokens from elsewhere are rejected. */
export const SESSION_ISS = "meridian-demo";

/** The two insurance cohorts the products API understands. */
export type Insurance = "unitedhealthcare" | "humana";

/** The claims we care about. `sub` is the member id, `name` is for display. */
export interface SessionClaims {
  sub: string;
  insurance: Insurance;
  name: string;
}

/**
 * Build the HMAC key from SESSION_SECRET.
 *
 * Read lazily (inside the function, not at module load) so a missing env var
 * surfaces as a clear runtime error on the first request rather than blowing up
 * the build.
 */
function getKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "SESSION_SECRET is missing or too short (need >= 32 chars). " +
        'Generate one: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))"',
    );
  }
  return new TextEncoder().encode(secret);
}

/**
 * Sign a session token for the given persona identity.
 * Called by the demo-login route handler.
 */
export async function createSessionToken(claims: SessionClaims): Promise<string> {
  return await new SignJWT({ insurance: claims.insurance, name: claims.name })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(claims.sub)
    .setIssuer(SESSION_ISS)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(getKey());
}

/**
 * Verify a token and return its claims, or `null` if anything is wrong
 * (missing, bad signature, wrong issuer, expired, malformed payload).
 *
 * Never throws - callers (proxy.ts, page.tsx) treat `null` as "not signed in".
 */
export async function verifySessionToken(
  token: string | undefined | null,
): Promise<SessionClaims | null> {
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getKey(), {
      algorithms: ["HS256"], // do not allow "none" or a downgraded alg
      issuer: SESSION_ISS,
    });

    // `payload` fields are typed as `unknown` - narrow them explicitly.
    const { sub, insurance, name } = payload as Record<string, unknown>;
    if (typeof sub !== "string") return null;
    if (insurance !== "unitedhealthcare" && insurance !== "humana") return null;
    if (typeof name !== "string") return null;

    return { sub, insurance, name };
  } catch {
    return null;
  }
}
