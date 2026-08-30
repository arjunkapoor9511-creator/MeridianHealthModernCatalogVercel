"use client";

// Fetches `/api/product-detail/<sku>` when the popup opens. A module-level cache
// keeps reopening the same product instant (and skips the round-trip). The
// request is aborted if the popup closes or switches products mid-flight.

import { useEffect, useRef, useState } from "react";

import type { ProductDetail } from "@/lib/catalog";

const cache = new Map<string, ProductDetail>();

export type ProductDetailState =
  | { status: "loading"; detail: null }
  | { status: "ready"; detail: ProductDetail }
  | { status: "error"; detail: null };

const LOADING: ProductDetailState = { status: "loading", detail: null };

export function useProductDetail(sku: string | undefined): ProductDetailState {
  // Async outcomes keyed by sku. Cache hits are resolved during render, below.
  const [results, setResults] = useState<Record<string, ProductDetailState>>({});
  const attempted = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!sku || cache.has(sku) || attempted.current.has(sku)) return;
    attempted.current.add(sku);

    const controller = new AbortController();

    fetch(`/api/product-detail/${encodeURIComponent(sku)}`, {
      signal: controller.signal,
    })
      .then((res) => {
        if (!res.ok) throw new Error(String(res.status));
        return res.json() as Promise<ProductDetail>;
      })
      .then((detail) => {
        cache.set(sku, detail);
        setResults((m) => ({ ...m, [sku]: { status: "ready", detail } }));
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") {
          // Popup closed / switched before this resolved — allow a later retry.
          attempted.current.delete(sku);
          return;
        }
        setResults((m) => ({ ...m, [sku]: { status: "error", detail: null } }));
      });

    return () => controller.abort();
  }, [sku]);

  if (!sku) return LOADING;
  const cached = cache.get(sku);
  if (cached) return { status: "ready", detail: cached };
  return results[sku] ?? LOADING;
}
