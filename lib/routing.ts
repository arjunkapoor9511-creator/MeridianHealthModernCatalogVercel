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

export async function resolveDestination(
  insurance: string,
  sub: string,
): Promise<Destination> {
  const cfg = await readConfig();

  // 1. Master kill switch: everyone to legacy, immediately.
  if (cfg.killSwitch === true) return "legacy";

  // 2. Per-member override wins over the cohort rule (canary / exclude).
  const overrides = isRecord(cfg.cohortOverrides) ? cfg.cohortOverrides : {};
  const override = overrides[sub];
  if (override === "modern" || override === "legacy") return override;

  // 3. Cohort rule.
  const migrated = isStringArray(cfg.migratedCohorts)
    ? cfg.migratedCohorts
    : DEFAULT_MIGRATED;
  return migrated.includes(insurance) ? "modern" : "legacy";
}

async function readConfig(): Promise<RoutingConfig> {
  if (!process.env.GLOBAL_CONFIG) return {};
  try {
    return await getAll<RoutingConfig>();
  } catch {
    return {}; // -> callers fall back to DEFAULT_MIGRATED
  }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === "string");
}
