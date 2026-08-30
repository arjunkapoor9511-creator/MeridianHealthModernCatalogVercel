"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCatalog } from "@/components/catalog/catalog-store";
import { SORT_OPTIONS, type SortKey } from "@/lib/catalog";

export function SortControl() {
  const { sort, setSort } = useCatalog();

  return (
    <label className="flex items-center gap-2 text-sm text-muted-foreground">
      <span className="hidden sm:inline">Sort</span>
      <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
        <SelectTrigger className="w-[190px]" aria-label="Sort products">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {SORT_OPTIONS.map((opt) => (
            <SelectItem key={opt.key} value={opt.key}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}
