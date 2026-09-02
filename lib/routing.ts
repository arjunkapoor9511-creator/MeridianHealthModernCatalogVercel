// ---------------------------------------------------------------------------
// Cohort routing decision
// ---------------------------------------------------------------------------
// proxy.ts calls resolveDestination() to decide whether a signed-in user is
// served this app ("modern") or transparently rewritten to the legacy
// marketplace ("legacy").
//
// The routing table lives in Vercel Global Config (formerly Edge Config) so it
// can be changed WITHOUT a redeploy - see scripts/cohort.mjs. Reads are
// sub-millisecond and add no meaningful latency to the proxy.
//
// Global Config shape (all keys optional):
//   {
//     "migratedCohorts": ["unitedhealthcare"],        // cohorts on the modern app
//     "cohortOverrides": { "HUM-20938": "modern" },    // per-member, wins over cohort
//     "killSwitch": false                              // true => everyone to legacy
//   }
//
// If Global Config is unset, unreachable, or malformed, routing falls back to
// DEFAULT_MIGRATED - so a config outage can never send a cohort somewhere
// untested.
// ---------------------------------------------------------------------------

import { getAll } from "@vercel/global-config";

export type Destination = "modern" | "legacy";

/** Conservative default used when Global Config can't be read. */
export const DEFAULT_MIGRATED: readonly string[] = ["unitedhealthcare"];

interface RoutingConfig {
  migratedCohorts?: unknown;
  cohortOverrides?: unknown;
  killSwitch?: unknown;
}

/**
 * Resolve where one signed-in member is served, RIGHT NOW.
 *
 * Called on every page request from proxy.ts (not cached, not memoised), so the
 * answer tracks Global Config within its propagation window (~seconds). One
 * consequence: editing the table mid-session can move an active session between
 * the modern and legacy apps on its next navigation - acceptable because edits
 * are rare and a flip is usually a deliberate cutover / rollback.
 *
 * Precedence, highest first: killSwitch -> per-member override -> cohort rule.
 * Every branch resolves to a concrete Destination; there is no "unknown".
 *
 * @param insurance  verified cohort key from the session JWT (e.g. "humana")
 * @param sub        verified member id from the session JWT - the override key
 */
export async function resolveDestination(
  insurance: string,
  sub: string,
): Promise<Destination> {
  // readConfig() never throws and never returns null - a bad/absent config
  // comes back as {} and every lookup below falls through to a safe default.
  const cfg = await readConfig();

  // 1. Master kill switch. One boolean flip in the dashboard sends EVERYONE to
  //    legacy on their next request - the instant-rollback lever for when the
  //    modern app is on fire. Checked first so nothing below can override it.
  //    Strict `=== true`: a missing / non-boolean value must NOT trip it.
  if (cfg.killSwitch === true) return "legacy";

  // 2. Per-member override. Pin one member regardless of their cohort - canary
  //    a single account onto modern before its cohort moves, or yank a specific
  //    account back to legacy without touching the whole cohort. Wins over the
  //    cohort rule (step 3), loses to the kill switch (step 1).
  const overrides = isRecord(cfg.cohortOverrides) ? cfg.cohortOverrides : {};
  const override = overrides[sub];
  // Ignore anything that isn't one of the two valid values (typo, stale shape).
  if (override === "modern" || override === "legacy") return override;

  // 3. Cohort rule - the normal path for ~everyone. A cohort is "migrated" once
  //    its slug is added to migratedCohorts; until then it stays on legacy.
  //    Fall back to DEFAULT_MIGRATED if the key is absent or not a string[], so
  //    a malformed config can only ever route to a cohort we've already vetted.
  const migrated = isStringArray(cfg.migratedCohorts)
    ? cfg.migratedCohorts
    : DEFAULT_MIGRATED;
  return migrated.includes(insurance) ? "modern" : "legacy";
}

/**
 * Read the whole routing table from Global Config. Total function: any failure
 * mode - connection string unset, store unreachable, network error - yields {},
 * which callers treat as "use the code defaults". Never throws.
 */
async function readConfig(): Promise<RoutingConfig> {
  // No connection string => Global Config isn't wired for this environment
  // (e.g. local dev). Skip the call entirely rather than let the SDK throw.
  if (!process.env.GLOBAL_CONFIG) return {};
  try {
    // getAll() returns the raw items object - fields are typed `unknown` here
    // and narrowed by the guards below at each use site.
    return await getAll<RoutingConfig>();
  } catch {
    return {}; // -> callers fall back to DEFAULT_MIGRATED
  }
}

// --- Runtime type guards --------------------------------------------------
// Global Config is hand-edited in the Vercel dashboard, so its contents are
// untrusted input: validate shape at the point of use, never assume it.

/** True for a plain object (not null, not an array) usable as a string map. */
function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** True only when every element is a string - a partially-string array fails. */
function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === "string");
}
