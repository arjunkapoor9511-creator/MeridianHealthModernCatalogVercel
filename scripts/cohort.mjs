#!/usr/bin/env node
// ---------------------------------------------------------------------------
// scripts/cohort.mjs  —  read-only cohort-routing inspector
// ---------------------------------------------------------------------------
// Shows the current Vercel Global Config routing table and the effective
// modern-vs-legacy destination for each cohort, then prints the exact edit to
// make in the dashboard to cut a cohort over or roll it back.
//
// Edits are done in the Vercel dashboard (Storage -> your Global Config store
// -> Items), NOT by this script - no API token required. Changes take effect
// globally in a few seconds, no redeploy.
//
//   node scripts/cohort.mjs            # or: node scripts/cohort.mjs status
//
// Reads GLOBAL_CONFIG from .env.local (the read-only connection string).
// ---------------------------------------------------------------------------

import { readFileSync } from "node:fs";
import { createClient } from "@vercel/global-config";

const KNOWN_COHORTS = ["unitedhealthcare", "humana"];
const DEFAULT_MIGRATED = ["unitedhealthcare"]; // must match lib/routing.ts

// load GLOBAL_CONFIG from .env.local if not already in the environment
if (!process.env.GLOBAL_CONFIG) {
  try {
    for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"]*)"?\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  } catch {
    /* rely on the environment */
  }
}

if (!process.env.GLOBAL_CONFIG) {
  console.error("Error: GLOBAL_CONFIG is not set (expected in .env.local).");
  process.exit(1);
}

const client = createClient(process.env.GLOBAL_CONFIG);
const cfg = await client.getAll();

const migrated = Array.isArray(cfg.migratedCohorts) ? cfg.migratedCohorts : DEFAULT_MIGRATED;
const usingFallback = !cfg.migratedCohorts;
const overrides = isRecord(cfg.cohortOverrides) ? cfg.cohortOverrides : {};
const killed = cfg.killSwitch === true;

console.log("Global Config items:");
console.log(indent(JSON.stringify(cfg, null, 2)));

console.log("\nEffective routing:");
console.log(`  killSwitch      : ${killed ? "ON  (every signed-in user -> legacy)" : "off"}`);
console.log(`  migratedCohorts : ${JSON.stringify(migrated)}${usingFallback ? "   <- key not set; using code fallback" : ""}`);
for (const c of KNOWN_COHORTS) {
  const dest = killed ? "legacy" : migrated.includes(c) ? "modern" : "legacy";
  console.log(`    ${c.padEnd(16)} -> ${dest}`);
}
if (Object.keys(overrides).length) {
  console.log("  per-member overrides:");
  for (const [sub, d] of Object.entries(overrides)) console.log(`    ${sub} -> ${d}`);
}

const notYet = KNOWN_COHORTS.filter((c) => !migrated.includes(c));
console.log("\nTo change routing: Vercel dashboard -> Storage -> Global Config -> Items");
if (notYet.length) {
  console.log(`  cut over : set  migratedCohorts = ${JSON.stringify([...migrated, ...notYet])}`);
}
if (migrated.length > 1 || !usingFallback) {
  console.log(`  roll back: set  migratedCohorts = ${JSON.stringify(DEFAULT_MIGRATED)}`);
}
console.log(`  panic    : set  killSwitch = true          (everyone -> legacy; set false to undo)`);
console.log(`  canary   : set  cohortOverrides = { "HUM-20938": "modern" }   (one member only)`);

function isRecord(v) {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
function indent(s) {
  return s
    .split("\n")
    .map((l) => "  " + l)
    .join("\n");
}
