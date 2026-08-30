"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { useCatalog } from "@/components/catalog/catalog-store";
import {
  NUMERIC_FACETS,
  NUMERIC_FACET_LABELS,
  categoryLabel,
  isFilterActive,
  type Facets,
  type NumericFacetKey,
  type NumericRange,
} from "@/lib/catalog";

function RangeFilter({
  facetKey,
  bounds,
}: {
  facetKey: NumericFacetKey;
  bounds: NumericRange;
}) {
  const { filters, setRange } = useCatalog();
  const current = filters.ranges[facetKey] ?? bounds;
  const step = facetKey === "weightKg" ? 1 : 10;

  return (
    <div className="space-y-3 py-1">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{current.min}</span>
        <span>{current.max}</span>
      </div>
      <Slider
        min={bounds.min}
        max={bounds.max}
        step={step}
        value={[current.min, current.max]}
        onValueChange={([min, max]) =>
          setRange(
            facetKey,
            min <= bounds.min && max >= bounds.max ? null : { min, max },
          )
        }
        aria-label={NUMERIC_FACET_LABELS[facetKey]}
      />
    </div>
  );
}

export function FilterPanel({ facets }: { facets: Facets }) {
  const { filters, toggleCategory, togglePropelling, clear } = useCatalog();

  const numericSections = NUMERIC_FACETS.filter((key) => facets.ranges[key]);
  const defaultOpen = [
    ...(facets.propellingMethods.length > 0 ? ["propelling"] : []),
    ...numericSections.map((k) => `num-${k}`),
  ];
  const active = isFilterActive(filters);

  return (
    <aside className="space-y-5">
      {/* Fixed height so toggling "Clear all" never reflows the rail. */}
      <div className="flex h-7 items-center justify-between">
        <h2 className="text-sm font-semibold">Filters</h2>
        <Button
          variant="ghost"
          size="xs"
          onClick={clear}
          tabIndex={active ? undefined : -1}
          aria-hidden={!active}
          className={active ? undefined : "pointer-events-none invisible"}
        >
          Clear all
        </Button>
      </div>

      {/* Category - the primary filter, always visible */}
      <div className="space-y-2">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Category
        </p>
        <div className="flex flex-wrap gap-2">
          {facets.categories.map((category) => {
            const active = filters.categories.includes(category);
            return (
              <button
                key={category}
                type="button"
                aria-pressed={active}
                onClick={() => toggleCategory(category)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-secondary text-secondary-foreground hover:bg-muted",
                )}
              >
                {categoryLabel(category)}
              </button>
            );
          })}
        </div>
      </div>

      {(facets.propellingMethods.length > 0 || numericSections.length > 0) && (
        <Accordion
          type="multiple"
          defaultValue={defaultOpen}
          className="border-t"
        >
          {facets.propellingMethods.length > 0 && (
            <AccordionItem value="propelling">
              <AccordionTrigger>Propelling method</AccordionTrigger>
              <AccordionContent className="space-y-2">
                {facets.propellingMethods.map((method) => (
                  <label
                    key={method}
                    className="flex items-center gap-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      className="size-4 accent-primary"
                      checked={filters.propellingMethods.includes(method)}
                      onChange={() => togglePropelling(method)}
                    />
                    {method}
                  </label>
                ))}
              </AccordionContent>
            </AccordionItem>
          )}

          {numericSections.map((key) => (
            <AccordionItem key={key} value={`num-${key}`}>
              <AccordionTrigger>{NUMERIC_FACET_LABELS[key]}</AccordionTrigger>
              <AccordionContent>
                <RangeFilter facetKey={key} bounds={facets.ranges[key]!} />
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}
    </aside>
  );
}
