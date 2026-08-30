// Landing page: renders the raw Azure products JSON for the signed-in user's
// insurance cohort, nothing else.
//
// The insurance provider is NOT hard-coded any more. proxy.ts verifies the
// mm_session cookie and injects `x-user-insurance` as a request header; we read
// it here. Modern Mark -> "unitedhealthcare", Legacy Luke -> "humana".
//
// Caching: `await headers()` is a request-time API, so this page renders
// dynamically (per request). The fetch() below has its own Data Cache keyed by
// full URL, so `?insurance=unitedhealthcare` and `?insurance=humana` each get an
// independent 5-minute entry - the Azure call stays cheap.

import { headers } from "next/headers";

export default async function Home() {
  const insurance = (await headers()).get("x-user-insurance");

  // Shouldn't happen in normal flow - proxy.ts redirects unauthenticated
  // requests before they reach here. This is a friendly fallback, not a 500.
  if (insurance !== "unitedhealthcare" && insurance !== "humana") {
    return (
      <div className="p-4 font-mono text-sm">
        <p>No session. Open the catalog from the MeridianHealth storefront.</p>
        {process.env.MARKETPLACE_ENTRY_URL ? (
          <p>
            <a
              className="underline"
              href={process.env.MARKETPLACE_ENTRY_URL}
            >
              Go to the storefront
            </a>
          </p>
        ) : null}
      </div>
    );
  }

  const res = await fetch(
    `${process.env.AZURE_PRODUCTS_URL}?insurance=${insurance}`,
    {
      headers: { "x-functions-key": process.env.AZURE_PRODUCTS_KEY! },
      // fetch is not cached by default in Next.js 16 - cache for 5 minutes.
      next: { revalidate: 300 },
    },
  );

  if (!res.ok) {
    throw new Error(
      `Products request failed: ${res.status} ${await res.text()}`,
    );
  }

  const data = await res.json();

  return (
    <pre className="overflow-x-auto p-4 font-mono text-sm leading-relaxed">
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}
