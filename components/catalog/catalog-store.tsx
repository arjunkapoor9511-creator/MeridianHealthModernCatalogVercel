"use client";

// ---------------------------------------------------------------------------
// Catalog filter + sort state. In-memory only (resets on reload). The filter
// rail and sort control write here; the product grid reads it and re-filters
// client-side - no server round-trips once the grid has loaded.
// ---------------------------------------------------------------------------

import {
  createContext,
  useContext,
  useMemo,
  useReducer,
  type ReactNode,
} from "react";
import {
  EMPTY_FILTERS,
  type FilterState,
  type NumericFacetKey,
  type NumericRange,
  type SortKey,
} from "@/lib/catalog";

interface CatalogState {
  filters: FilterState;
  sort: SortKey;
}

type CatalogAction =
  | { type: "toggleCategory"; value: string }
  | { type: "togglePropelling"; value: string }
  | { type: "setRange"; key: NumericFacetKey; range: NumericRange | null }
  | { type: "setSort"; sort: SortKey }
  | { type: "clear" };

const toggle = (list: string[], value: string): string[] =>
  list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

function reducer(state: CatalogState, action: CatalogAction): CatalogState {
  switch (action.type) {
    case "toggleCategory":
      return {
        ...state,
        filters: {
          ...state.filters,
          categories: toggle(state.filters.categories, action.value),
        },
      };
    case "togglePropelling":
      return {
        ...state,
        filters: {
          ...state.filters,
          propellingMethods: toggle(
            state.filters.propellingMethods,
            action.value,
          ),
        },
      };
    case "setRange": {
      const ranges = { ...state.filters.ranges };
      if (action.range) ranges[action.key] = action.range;
      else delete ranges[action.key];
      return { ...state, filters: { ...state.filters, ranges } };
    }
    case "setSort":
      return { ...state, sort: action.sort };
    case "clear":
      return { ...state, filters: EMPTY_FILTERS };
    default:
      return state;
  }
}

interface CatalogContextValue extends CatalogState {
  toggleCategory: (value: string) => void;
  togglePropelling: (value: string) => void;
  setRange: (key: NumericFacetKey, range: NumericRange | null) => void;
  setSort: (sort: SortKey) => void;
  clear: () => void;
}

const CatalogContext = createContext<CatalogContextValue | null>(null);

export function CatalogProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, {
    filters: EMPTY_FILTERS,
    sort: "featured",
  });

  const value = useMemo<CatalogContextValue>(
    () => ({
      ...state,
      toggleCategory: (value) => dispatch({ type: "toggleCategory", value }),
      togglePropelling: (value) => dispatch({ type: "togglePropelling", value }),
      setRange: (key, range) => dispatch({ type: "setRange", key, range }),
      setSort: (sort) => dispatch({ type: "setSort", sort }),
      clear: () => dispatch({ type: "clear" }),
    }),
    [state],
  );

  return (
    <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>
  );
}

export function useCatalog(): CatalogContextValue {
  const ctx = useContext(CatalogContext);
  if (!ctx) throw new Error("useCatalog must be used within <CatalogProvider>");
  return ctx;
}
