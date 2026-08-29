// Landing page: fetches the Azure products endpoint on the server and renders
// the raw JSON response, nothing else.

// Which insurance provider to request. Allowed: "unitedhealthcare" | "humana".
const INSURANCE = "unitedhealthcare";

export default async function Home() {
  const res = await fetch(
    `${process.env.AZURE_PRODUCTS_URL}?insurance=${INSURANCE}`,
    {
      headers: { "x-functions-key": process.env.AZURE_PRODUCTS_KEY! },
      // fetch is not cached by default in Next.js 16 — cache for 5 minutes.
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
