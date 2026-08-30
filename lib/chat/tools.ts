// ---------------------------------------------------------------------------
// Catalog chatbot tools
// ---------------------------------------------------------------------------
// Two tools, both bound to the signed-in member's insurance cohort:
//
//   searchProducts  - hybrid vector + keyword search (Azure AI Search), hydrated
//                     into full Product objects via getProducts(insurance).
//   getProductInfo  - the rich per-SKU record (description / specs / warranty)
//                     for answering a question about one product.
//
// Cohort safety: every product returned is looked up in getProducts(insurance),
// so a SKU outside the member's plan can never reach the model or the UI, even
// if Azure's filter is wrong. See DECISIONS.md.
// ---------------------------------------------------------------------------

import "server-only";

import { tool } from "ai";
import { z } from "zod";

import { getProductDetail, getProducts } from "@/lib/products";
import type { Insurance, Product, ProductDetail } from "@/lib/catalog";
import { searchCatalog } from "@/lib/chat/search";

/** Cap on how many product cards one recommendation turn renders. */
const MAX_RECOMMENDATIONS = 6;

export interface SearchProductsResult {
  products: Product[];
  /** Present only when the search backend was unavailable. */
  error?: string;
}

export type GetProductInfoResult =
  | { found: false }
  | { found: true; product: Product; detail: ProductDetail | null };

/**
 * Build the tool set for one request. `insurance` comes from the verified
 * session, never from the model.
 */
export function buildChatTools(insurance: Insurance) {
  return {
    searchProducts: tool({
      description:
        "Search the member's covered catalog for products matching a need or " +
        "description (e.g. 'lightweight folding wheelchair for travel'). " +
        "Returns matching products; the UI renders them as cards, so keep your " +
        "own reply to a short framing sentence. Only use for recommendations.",
      inputSchema: z.object({
        query: z
          .string()
          .describe(
            "A natural-language description of what the member needs. " +
              "Include the salient constraints (weight, size, use case).",
          ),
      }),
      execute: async ({ query }): Promise<SearchProductsResult> => {
        let hits;
        try {
          hits = await searchCatalog(query);
        } catch (err) {
          console.error("searchProducts: Azure search failed", err);
          return {
            products: [],
            error: "The product search service is unavailable right now.",
          };
        }

        // Hydrate against the member's catalog. This is the cohort guard: the
        // search index spans all products and has no cohort field, so any SKU
        // not in getProducts(insurance) is dropped here.
        const catalog = await getProducts(insurance);
        const bySku = new Map(catalog.map((p) => [p.sku, p]));

        const products: Product[] = [];
        for (const hit of hits) {
          const product = bySku.get(hit.sku);
          if (product && !products.includes(product)) products.push(product);
          if (products.length >= MAX_RECOMMENDATIONS) break;
        }

        return { products };
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
  };
}

export type ChatToolSet = ReturnType<typeof buildChatTools>;
