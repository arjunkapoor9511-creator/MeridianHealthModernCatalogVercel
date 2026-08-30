"use client";

// ---------------------------------------------------------------------------
// Cart state: a client-only store shared by the header basket button, the
// product cards, and the slide-over sheet. Persisted to localStorage so it
// survives a reload. SSR renders an empty cart; the stored cart is rehydrated
// in an effect after mount (so the server and first client render match).
// ---------------------------------------------------------------------------

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Product } from "@/lib/catalog";

const STORAGE_KEY = "mm_cart_v1";

export interface CartLine {
  product: Product;
  qty: number;
}

type CartState = CartLine[];

type CartAction =
  | { type: "hydrate"; lines: CartState }
  | { type: "add"; product: Product; qty?: number }
  | { type: "setQty"; id: number; qty: number }
  | { type: "remove"; id: number }
  | { type: "clear" };

function reducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case "hydrate":
      return action.lines;
    case "add": {
      const qty = action.qty ?? 1;
      const existing = state.find((l) => l.product.id === action.product.id);
      if (existing) {
        return state.map((l) =>
          l.product.id === action.product.id
            ? { ...l, qty: l.qty + qty }
            : l,
        );
      }
      return [...state, { product: action.product, qty }];
    }
    case "setQty":
      return state
        .map((l) =>
          l.product.id === action.id ? { ...l, qty: action.qty } : l,
        )
        .filter((l) => l.qty > 0);
    case "remove":
      return state.filter((l) => l.product.id !== action.id);
    case "clear":
      return [];
    default:
      return state;
  }
}

interface CartContextValue {
  lines: CartLine[];
  count: number;
  subtotal: number;
  add: (product: Product, qty?: number) => void;
  setQty: (id: number, qty: number) => void;
  remove: (id: number) => void;
  clear: () => void;
  open: boolean;
  setOpen: (open: boolean) => void;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, dispatch] = useReducer(reducer, []);
  const [open, setOpen] = useState(false);
  const firstPersist = useRef(true);

  // Load any persisted cart once, after mount (localStorage is client-only, so
  // the server and first client render both start from an empty cart).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? (JSON.parse(raw) as CartLine[]) : null;
      if (Array.isArray(parsed) && parsed.length > 0) {
        dispatch({ type: "hydrate", lines: parsed });
      }
    } catch {
      /* ignore malformed / unavailable storage */
    }
  }, []);

  // Persist on change. Skip the initial mount render so the empty starting
  // state never clobbers a stored cart before the rehydrate effect runs.
  useEffect(() => {
    if (firstPersist.current) {
      firstPersist.current = false;
      return;
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
    } catch {
      /* storage full or unavailable - non-fatal */
    }
  }, [lines]);

  const value = useMemo<CartContextValue>(() => {
    const count = lines.reduce((n, l) => n + l.qty, 0);
    const subtotal = lines.reduce((n, l) => n + l.qty * l.product.price, 0);
    return {
      lines,
      count,
      subtotal,
      add: (product, qty) => dispatch({ type: "add", product, qty }),
      setQty: (id, qty) => dispatch({ type: "setQty", id, qty }),
      remove: (id) => dispatch({ type: "remove", id }),
      clear: () => dispatch({ type: "clear" }),
      open,
      setOpen,
    };
  }, [lines, open]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within <CartProvider>");
  return ctx;
}
