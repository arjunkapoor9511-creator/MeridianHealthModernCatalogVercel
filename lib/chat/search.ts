// ---------------------------------------------------------------------------
// Azure AI Search — product retrieval for the catalog chatbot
// ---------------------------------------------------------------------------
// Hybrid query (BM25 keyword + vector) against the product-statement index. The
// index has an integrated vectorizer, so we send the raw query text
// (`kind: "text"`) and Azure embeds it server-side — no embedding call here.
//
// The index is a KNOWLEDGE base of product "statements" (one row per fact about
// a product), not one document per product — so a query returns several rows,
// often multiple per SKU. This module collapses them to distinct SKUs (best
// score first) plus the statement that matched. The caller
// (lib/chat/tools.ts) hydrates each SKU against `getProducts(insurance)`, which
// is what actually enforces the member's cohort — the index has no cohort field.
//
// Live index fields (2026-08-30): id (key), statement, statement_vector
// (3072-dim), product_name, primary_sku, brand, category, component, optional,
// part_number, applies_to_sku, source_file. Only `id` is filterable.
//
// Secrets (endpoint / query key) are read here on the server, mirroring
// lib/products.ts. Never import this into a client component.
// ---------------------------------------------------------------------------

import "server-only";

const API_VERSION = "2026-04-01";
/** Vector field the query embedding is compared against. */
const VECTOR_FIELD = "statement_vector";
/** Field the product SKU comes back on (used to hydrate against the catalog). */
const SKU_FIELD = "primary_sku";
const NAME_FIELD = "product_name";
const STATEMENT_FIELD = "statement";

/** How many neighbours the vector clause pulls before fusion. */
const VECTOR_K = 50;
/** How many fused statement rows to pull (several map to the same SKU). */
const TOP = 30;

export interface SearchHit {
  sku: string;
  score: number;
  /** The product name as stored in the index (for logging / disambiguation). */
  productName: string;
  /** The statement chunk that matched — useful context for the model. */
  statement: string;
}

interface AzureSearchDoc {
  [key: string]: unknown;
  "@search.score"?: number;
}

interface AzureSearchResponse {
  value: AzureSearchDoc[];
}

const str = (v: unknown): string => (typeof v === "string" ? v : "");

/**
 * Hybrid vector + keyword search. Returns distinct SKUs in relevance order, each
 * with the top statement that matched. Throws on a misconfigured environment or
 * a non-OK response — the caller turns that into a graceful chat message.
 */
export async function searchCatalog(query: string): Promise<SearchHit[]> {
  const endpoint = process.env.AZURE_SEARCH_ENDPOINT;
  const index = process.env.AZURE_SEARCH_INDEX;
  const key = process.env.AZURE_SEARCH_KEY;
  if (!endpoint || !index || !key) {
    throw new Error(
      "AZURE_SEARCH_ENDPOINT / AZURE_SEARCH_INDEX / AZURE_SEARCH_KEY are not configured",
    );
  }

  const url =
    `${endpoint.replace(/\/$/, "")}/indexes/${encodeURIComponent(index)}` +
    `/docs/search?api-version=${API_VERSION}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", "api-key": key },
    body: JSON.stringify({
      search: query,
      queryType: "simple",
      top: TOP,
      select: [SKU_FIELD, NAME_FIELD, STATEMENT_FIELD].join(","),
      vectorQueries: [
        { kind: "text", text: query, fields: VECTOR_FIELD, k: VECTOR_K },
      ],
    }),
  });

  if (!res.ok) {
    throw new Error(
      `Azure AI Search request failed: ${res.status} ${await res.text()}`,
    );
  }

  const data = (await res.json()) as AzureSearchResponse;

  // Collapse statement rows to distinct SKUs, keeping the first (best-ranked)
  // statement seen for each.
  const bySku = new Map<string, SearchHit>();
  for (const doc of data.value) {
    const sku = str(doc[SKU_FIELD]);
    if (!sku || bySku.has(sku)) continue;
    bySku.set(sku, {
      sku,
      score: typeof doc["@search.score"] === "number" ? doc["@search.score"] : 0,
      productName: str(doc[NAME_FIELD]),
      statement: str(doc[STATEMENT_FIELD]),
    });
  }

  return [...bySku.values()];
}
