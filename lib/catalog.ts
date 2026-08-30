// ---------------------------------------------------------------------------
// Catalog domain: shared types, the raw-API mapper, and the pure filter / sort /
// facet helpers used by both the server (facet derivation) and the client
// (interactive grid). No React, no server-only imports - safe everywhere.
// ---------------------------------------------------------------------------

import type { Insurance } from "@/lib/session";

export type { Insurance };

/** Raw row shape from the Azure products API (PascalCase). */
export interface ProductRow {
  ProductId: number;
  Slug: string;
  Name: string;
  Sku: string;
  Category: string;
  InsuranceProviderSlug: string;
  BrandName: string;
  Price: number;
  CompareAtPrice: number | null;
  GridImageUrl: string;
  GridImageAlt: string | null;
  LengthMm: number | null;
  WidthMm: number | null;
  HeightMm: number | null;
  WeightKg: number | null;
  SafeWorkingLoadKg: number | null;
  PropellingMethod: string | null;
}

export interface ProductsResponse {
  insuranceProvider: string;
  count: number;
  products: ProductRow[];
}

/** Normalised product used throughout the UI (camelCase, nulls preserved). */
export interface Product {
  id: number;
  slug: string;
  name: string;
  sku: string;
  category: string;
  brand: string;
  price: number;
  compareAtPrice: number | null;
  imageUrl: string;
  imageAlt: string;
  lengthMm: number | null;
  widthMm: number | null;
  heightMm: number | null;
  weightKg: number | null;
  safeWorkingLoadKg: number | null;
  propellingMethod: string | null;
}

export function mapProductRow(row: ProductRow): Product {
  return {
    id: row.ProductId,
    slug: row.Slug,
    name: row.Name,
    sku: row.Sku,
    category: row.Category,
    brand: row.BrandName,
    price: row.Price,
    compareAtPrice: row.CompareAtPrice,
    imageUrl: row.GridImageUrl,
    imageAlt: row.GridImageAlt?.trim() || row.Name,
    lengthMm: row.LengthMm,
    widthMm: row.WidthMm,
    heightMm: row.HeightMm,
    weightKg: row.WeightKg,
    safeWorkingLoadKg: row.SafeWorkingLoadKg,
    propellingMethod: row.PropellingMethod,
  };
}

// --- Facets ----------------------------------------------------------------

/** Numeric product fields the range filters operate on. */
export const NUMERIC_FACETS = [
  "lengthMm",
  "widthMm",
  "heightMm",
  "weightKg",
  "safeWorkingLoadKg",
] as const;
export type NumericFacetKey = (typeof NUMERIC_FACETS)[number];

export const NUMERIC_FACET_LABELS: Record<NumericFacetKey, string> = {
  lengthMm: "Length (mm)",
  widthMm: "Width (mm)",
  heightMm: "Height (mm)",
  weightKg: "Weight (kg)",
  safeWorkingLoadKg: "Safe working load (kg)",
};

export interface NumericRange {
  min: number;
  max: number;
}

export interface Facets {
  categories: string[];
  brands: string[];
  propellingMethods: string[];
  /** Only present for fields the cohort actually has data for. */
  ranges: Partial<Record<NumericFacetKey, NumericRange>>;
}

const uniqueSorted = (values: string[]): string[] =>
  [...new Set(values)].sort((a, b) => a.localeCompare(b));

export function deriveFacets(products: Product[]): Facets {
  const ranges: Partial<Record<NumericFacetKey, NumericRange>> = {};
  for (const key of NUMERIC_FACETS) {
    const values = products
      .map((p) => p[key])
      .filter((v): v is number => typeof v === "number");
    if (values.length > 0) {
      ranges[key] = { min: Math.min(...values), max: Math.max(...values) };
    }
  }

  return {
    categories: uniqueSorted(products.map((p) => p.category)),
    brands: uniqueSorted(products.map((p) => p.brand)),
    propellingMethods: uniqueSorted(
      products
        .map((p) => p.propellingMethod)
        .filter((v): v is string => typeof v === "string"),
    ),
    ranges,
  };
}

// --- Filtering ------------------------------------------------------------

export interface FilterState {
  /** Selected categories; empty = all. */
  categories: string[];
  /** Selected propelling methods; empty = all. */
  propellingMethods: string[];
  /** Active numeric bounds; a key present here means the user narrowed it. */
  ranges: Partial<Record<NumericFacetKey, NumericRange>>;
}

export const EMPTY_FILTERS: FilterState = {
  categories: [],
  propellingMethods: [],
  ranges: {},
};

export function filterProducts(
  products: Product[],
  state: FilterState,
): Product[] {
  return products.filter((product) => {
    if (
      state.categories.length > 0 &&
      !state.categories.includes(product.category)
    ) {
      return false;
    }

    if (state.propellingMethods.length > 0) {
      if (
        !product.propellingMethod ||
        !state.propellingMethods.includes(product.propellingMethod)
      ) {
        return false;
      }
    }

    for (const key of NUMERIC_FACETS) {
      const bound = state.ranges[key];
      if (!bound) continue;
      const value = product[key];
      // An active numeric filter excludes products with no value for it.
      if (typeof value !== "number") return false;
      if (value < bound.min || value > bound.max) return false;
    }

    return true;
  });
}

export function isFilterActive(state: FilterState): boolean {
  return (
    state.categories.length > 0 ||
    state.propellingMethods.length > 0 ||
    Object.keys(state.ranges).length > 0
  );
}

// --- Sorting -------------------------------------------------------------

export const SORT_OPTIONS = [
  { key: "featured", label: "Featured" },
  { key: "price-asc", label: "Price: low to high" },
  { key: "price-desc", label: "Price: high to low" },
  { key: "name-asc", label: "Name: A–Z" },
  { key: "weight-asc", label: "Weight: light to heavy" },
  { key: "swl-desc", label: "Safe working load: high to low" },
] as const;

export type SortKey = (typeof SORT_OPTIONS)[number]["key"];

// Nulls always sort last regardless of direction.
const nullsLast = (a: number | null, b: number | null, cmp: number): number => {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return cmp;
};

export function sortProducts(products: Product[], key: SortKey): Product[] {
  const sorted = [...products];
  switch (key) {
    case "price-asc":
      return sorted.sort((a, b) => a.price - b.price);
    case "price-desc":
      return sorted.sort((a, b) => b.price - a.price);
    case "name-asc":
      return sorted.sort((a, b) => a.name.localeCompare(b.name));
    case "weight-asc":
      return sorted.sort((a, b) =>
        nullsLast(a.weightKg, b.weightKg, (a.weightKg ?? 0) - (b.weightKg ?? 0)),
      );
    case "swl-desc":
      return sorted.sort((a, b) =>
        nullsLast(
          a.safeWorkingLoadKg,
          b.safeWorkingLoadKg,
          (b.safeWorkingLoadKg ?? 0) - (a.safeWorkingLoadKg ?? 0),
        ),
      );
    case "featured":
    default:
      return sorted;
  }
}

// --- Formatting --------------------------------------------------------

const priceFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export const formatPrice = (value: number): string => priceFormatter.format(value);

export function categoryLabel(slug: string): string {
  const words = slug.replace(/-/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export const INSURANCE_LABELS: Record<Insurance, string> = {
  unitedhealthcare: "UnitedHealthcare",
  humana: "Humana",
};

// --- Product detail ------------------------------------------------------
// The `productdetail` API returns the richer per-SKU record the popup needs.
// Its payload is camelCase (unlike the PascalCase list API) and split into a
// `product` summary (fields we mostly already have on `Product`) and a `detail`
// block (description, features, an arbitrary `specs` bag, a gallery, files).

/** Raw shape of `GET /api/productdetail?sku=...`. Only the fields we read. */
export interface ProductDetailResponse {
  product: {
    sku: string;
    slug: string;
    name: string;
  };
  detail: {
    shortDescription: string | null;
    description: string | null;
    warranty: string | null;
    specs: Record<string, string | number | null> | null;
    features: string[] | null;
    images:
      | {
          url: string;
          alt: string | null;
          sortOrder: number;
          width: number;
          height: number;
        }[]
      | null;
    files: { label: string; url: string; sizeBytes: number }[] | null;
    sourceUrl: string | null;
  };
}

export interface ProductImage {
  url: string;
  alt: string;
  width: number;
  height: number;
}

export interface ProductFile {
  label: string;
  url: string;
  sizeBytes: number;
}

export interface ProductSpec {
  label: string;
  value: string;
}

/** Normalised detail record (camelCase, gallery sorted, specs flattened). */
export interface ProductDetail {
  sku: string;
  slug: string;
  description: string | null;
  warranty: string | null;
  features: string[];
  specs: ProductSpec[];
  images: ProductImage[];
  files: ProductFile[];
}

// Trailing unit tokens on spec keys, longest first (so `Kmh` beats `Km`).
const SPEC_UNIT_SUFFIXES: readonly [string, string][] = [
  ["Kmh", "km/h"],
  ["Mm", "mm"],
  ["Cm", "cm"],
  ["Km", "km"],
  ["Kg", "kg"],
];

/**
 * Turn a camelCase spec key into a human label, lifting a trailing unit token
 * into parentheses: `overallLengthMm` -> "Overall length (mm)",
 * `maxSpeedKmh` -> "Max speed (km/h)", `batteryType` -> "Battery type".
 */
export function formatSpecLabel(key: string): string {
  let base = key;
  let unit = "";
  for (const [suffix, label] of SPEC_UNIT_SUFFIXES) {
    if (base.length > suffix.length && base.endsWith(suffix)) {
      base = base.slice(0, -suffix.length);
      unit = label;
      break;
    }
  }
  const words = base
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .trim();
  const sentence = words.charAt(0).toUpperCase() + words.slice(1);
  return unit ? `${sentence} (${unit})` : sentence;
}

/** Bytes -> a short human size, e.g. `1806226` -> "1.7 MB". */
export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  const value = bytes / 1024 ** i;
  const digits = i === 0 || value >= 10 ? 0 : 1;
  return `${value.toFixed(digits)} ${units[i]}`;
}

export function mapProductDetail(raw: ProductDetailResponse): ProductDetail {
  const { product, detail } = raw;

  const images: ProductImage[] = [...(detail.images ?? [])]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((img) => ({
      url: img.url,
      alt: img.alt?.trim() || product.name,
      width: img.width || 1000,
      height: img.height || 1000,
    }));

  const specs: ProductSpec[] = Object.entries(detail.specs ?? {})
    .filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== "")
    .map(([key, v]) => ({ label: formatSpecLabel(key), value: String(v) }));

  return {
    sku: product.sku,
    slug: product.slug,
    description:
      detail.description?.trim() || detail.shortDescription?.trim() || null,
    warranty: detail.warranty?.trim() || null,
    features: (detail.features ?? []).filter((f) => f && f.trim().length > 0),
    specs,
    images,
    files: (detail.files ?? []).map((f) => ({
      label: f.label,
      url: f.url,
      sizeBytes: f.sizeBytes,
    })),
  };
}
