// ---------------------------------------------------------------------------
// Catalog chatbot tools
// ---------------------------------------------------------------------------
// Three tools, all bound to the signed-in member's insurance cohort:
//
//   findProducts   - hybrid vector + keyword search (Azure AI Search). Returns
//                    lightweight candidates for the model to reason over. Falls
//                    back to a keyword match over the cohort catalog when Azure
//                    is unavailable, so recommendations still work.
//   getProductInfo - the rich per-SKU record (description / specs / warranty)
//                    for answering a question about one product.
//   showProducts   - renders up to 3 product cards with "Add to basket". The
//                    model calls this to surface products: after a
//                    recommendation, or once it has confirmed a specific
//                    product meets a requirement the member stated.
//
// Cohort safety: every SKU is looked up in getProducts(insurance) before it can
// reach the model or the UI, so a product outside the member's plan can never
// surface. See DECISIONS.md.
// ---------------------------------------------------------------------------

import "server-only";

import { tool } from "ai";
import { z } from "zod";

import { getProductDetail, getProducts } from "@/lib/products";
import {
  categoryLabel,
  type Insurance,
  type Product,
  type ProductDetail,
} from "@/lib/catalog";
import { searchCatalog } from "@/lib/chat/search";

/** Hard cap on product cards shown in one turn. */
export const MAX_CARDS = 3;

export interface ProductCandidate {
  sku: string;
  name: string;
  brand: string;
  category: string;
}

export interface FindProductsResult {
  candidates: ProductCandidate[];
  /** True when Azure search was unavailable and this is a keyword fallback. */
  degraded: boolean;
}

export type GetProductInfoResult =
  | { found: false }
  | { found: true; product: Product; detail: ProductDetail | null };

export interface ShowProductsResult {
  products: Product[];
}

const toCandidate = (p: Product): ProductCandidate => ({
  sku: p.sku,
  name: p.name,
  brand: p.brand,
  category: categoryLabel(p.category),
});

/** Cheap token-overlap score over the fields a member would describe. */
function keywordRank(catalog: Product[], query: string): Product[] {
  const terms = query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 2);
  if (terms.length === 0) return catalog;

  return catalog
    .map((p) => {
      const haystack =
        `${p.name} ${p.brand} ${p.category} ${p.propellingMethod ?? ""}`.toLowerCase();
      const score = terms.reduce((n, t) => (haystack.includes(t) ? n + 1 : n), 0);
      return { p, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.p);
}

/**
 * Build the tool set for one request. `insurance` comes from the verified
 * session, never from the model.
 */
export function buildChatTools(insurance: Insurance) {
  return {
    findProducts: tool({
      description:
        "Find products in the member's covered catalog that match a need or " +
        "description (e.g. 'lightweight folding wheelchair for travel'). Returns " +
        "candidate products for you to consider — it does NOT display anything. " +
        "After choosing, call showProducts to display your picks.",
      inputSchema: z.object({
        query: z
          .string()
          .describe(
            "A natural-language description of the member's need, including the " +
              "salient constraints (weight, size, use case).",
          ),
      }),
      execute: async ({ query }): Promise<FindProductsResult> => {
        const catalog = await getProducts(insurance);
        const bySku = new Map(catalog.map((p) => [p.sku, p]));

        try {
          const hits = await searchCatalog(query);
          const ranked: Product[] = [];
          for (const hit of hits) {
            const p = bySku.get(hit.sku);
            if (p && !ranked.includes(p)) ranked.push(p);
          }
          if (ranked.length > 0) {
            return { candidates: ranked.map(toCandidate), degraded: false };
          }
          // Search worked but nothing in the cohort matched — fall through to
          // the keyword pass so the member still gets something considered.
        } catch (err) {
          console.error("findProducts: Azure search unavailable", err);
        }

        const fallback = keywordRank(catalog, query);
        return {
          candidates: (fallback.length > 0 ? fallback : catalog).map(
            toCandidate,
          ),
          degraded: true,
        };
      },
    }),

    getProductInfo: tool({
      description:
        "Get the full detail record for one product in the member's catalog " +
        "(description, features, specifications, warranty, documents). Use this " +
        "to answer a question about a specific product. Pass the product's SKU.",
      inputSchema: z.object({
        sku: z.string().describe("The exact product SKU."),
      }),
      execute: async ({ sku }): Promise<GetProductInfoResult> => {
        const catalog = await getProducts(insurance);
        const product = catalog.find((p) => p.sku === sku);
        if (!product) return { found: false };

        let detail: ProductDetail | null = null;
        try {
          detail = await getProductDetail(sku);
        } catch (err) {
          console.error("getProductInfo: detail fetch failed", err);
        }

        return { found: true, product, detail };
      },
    }),

    showProducts: tool({
      description:
        "Display product cards (with an 'Add to basket' button) for up to " +
        `${MAX_CARDS} products. Call this to surface your recommendations, and ` +
        "also whenever you have just confirmed that a specific product meets a " +
        "requirement the member stated (it fits, it's light enough, the range " +
        "is sufficient, etc.) — so they can add it straight to their basket. " +
        "Do NOT call it when the answer is that the product does NOT fit the need.",
      inputSchema: z.object({
        skus: z
          .array(z.string())
          .min(1)
          .max(MAX_CARDS)
          .describe("Exact SKUs of the products to display, best first."),
      }),
      execute: async ({ skus }): Promise<ShowProductsResult> => {
        const catalog = await getProducts(insurance);
        const bySku = new Map(catalog.map((p) => [p.sku, p]));

        const products: Product[] = [];
        for (const sku of skus) {
          const p = bySku.get(sku);
          if (p && !products.includes(p)) products.push(p);
          if (products.length >= MAX_CARDS) break;
        }
        return { products };
      },
    }),
  };
}

export type ChatToolSet = ReturnType<typeof buildChatTools>;
