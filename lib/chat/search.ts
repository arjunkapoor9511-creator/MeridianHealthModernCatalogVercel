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
// Auth: Vercel OIDC -> Entra ID federated credential (see
// https://vercel.com/docs/oidc/azure), not an API key. The search service's
// "Search Index Data Reader" role is granted to the Entra app registration
// identified by AZURE_TENANT_ID / AZURE_CLIENT_ID (see .env.example). No
// secret is stored anywhere — `ClientAssertionCredential` exchanges the
// environment's Vercel-issued OIDC token for a short-lived Entra ID access
// token per request, cached and refreshed internally until it's close to
// expiry. Never import this into a client component.
// ---------------------------------------------------------------------------

import "server-only";
import { FatalError, RetryableError } from "workflow";
import { ClientAssertionCredential, type TokenCredential } from "@azure/identity";
import { getVercelOidcToken } from "@vercel/oidc";

const API_VERSION = "2026-04-01";
/**
 * Entra ID's recommended audience for workload identity federation — must
 * match the "Audience" field on the federated credential in the Azure portal.
 */
const AZURE_OIDC_AUDIENCE = "api://AzureADTokenExchange";
/** Token scope for Azure AI Search's data plane (queries, not management). */
const AZURE_SEARCH_TOKEN_SCOPE = "https://search.azure.com/.default";

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
 * Built once and reused — `ClientAssertionCredential` caches the exchanged
 * Entra ID access token internally and only re-exchanges it as it nears
 * expiry, so this does not mean a fresh token exchange per search call.
 */
let searchCredential: TokenCredential | undefined;

function getSearchCredential(): TokenCredential {
  if (searchCredential) return searchCredential;

  const tenantId = process.env.AZURE_TENANT_ID;
  const clientId = process.env.AZURE_CLIENT_ID;
  if (!tenantId || !clientId) {
    throw new FatalError(
      "AZURE_TENANT_ID / AZURE_CLIENT_ID are not configured",
    );
  }

  searchCredential = new ClientAssertionCredential(tenantId, clientId, () =>
    getVercelOidcToken({ audience: AZURE_OIDC_AUDIENCE }),
  );
  return searchCredential;
}

/**
 * Hybrid vector + keyword search. Returns distinct SKUs in relevance order, each
 * with the top statement that matched. Throws on a misconfigured environment or
 * a non-OK response — the caller turns that into a graceful chat message.
 */
export async function searchCatalog(query: string): Promise<SearchHit[]> {
  const endpoint = process.env.AZURE_SEARCH_ENDPOINT;
  const index = process.env.AZURE_SEARCH_INDEX;
  if (!endpoint || !index) {
    // Misconfiguration — retrying won't fix a missing env var.
    throw new FatalError(
      "AZURE_SEARCH_ENDPOINT / AZURE_SEARCH_INDEX are not configured",
    );
  }

  // Exchanges (or reuses a cached) Vercel OIDC token for a short-lived Entra
  // ID access token — see the module comment. Not an API key: nothing here
  // is a stored secret.
  const accessToken = await getSearchCredential().getToken(
    AZURE_SEARCH_TOKEN_SCOPE,
  );
  if (!accessToken) {
    throw new FatalError("Failed to acquire an Entra ID access token");
  }

  const url =
    `${endpoint.replace(/\/$/, "")}/indexes/${encodeURIComponent(index)}` +
    `/docs/search?api-version=${API_VERSION}`;

  const res = await fetch(url, {
    method: "POST",
    // Bearer token, not `api-key` — Azure AI Search authenticates with
    // whichever credential is present, and an api-key header would silently
    // win over role-based auth if both were ever sent.
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${accessToken.token}`,
    },
    body: JSON.stringify({
      // BM25 keyword leg. `simple` parser — the query is a member's phrasing,
      // not Lucene syntax.
      search: query,
      queryType: "simple",
      top: TOP,
      // Only pull the fields we actually use — SKU to hydrate, name/statement
      // for logging and model context.
      select: [SKU_FIELD, NAME_FIELD, STATEMENT_FIELD].join(","),
      // Vector leg. `kind: "text"` -> the index's integrated vectorizer embeds
      // the query server-side; Azure fuses the two legs (RRF) into one ranking.
      vectorQueries: [
        { kind: "text", text: query, fields: VECTOR_FIELD, k: VECTOR_K },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    // Rate limited / transient service issue — the step should retry.
    if (res.status === 429 || res.status >= 500) {
      throw new RetryableError(
        `Azure AI Search request failed: ${res.status} ${body}`,
        res.status === 429 ? { retryAfter: "10s" } : undefined,
      );
    }
    // A 4xx here means a bad request or bad credentials — retrying won't help.
    throw new FatalError(
      `Azure AI Search request failed: ${res.status} ${body}`,
    );
  }

  const data = (await res.json()) as AzureSearchResponse;

  // Collapse statement rows to distinct SKUs, keeping the first (best-ranked)
  // statement seen for each.
  const bySku = new Map<string, SearchHit>();
  for (const doc of data.value) {
    // `data.value` is already in fused-relevance order, so the first row we see
    // for a SKU is its best-scoring statement — keep that one, skip the rest.
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
