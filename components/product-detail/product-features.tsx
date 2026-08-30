import { Check } from "lucide-react";

/** Features often arrive as "Short label: explanation" — bold the label. */
export function ProductFeatures({ features }: { features: string[] }) {
  if (features.length === 0) return null;

  return (
    <section>
      <h3 className="mb-2 text-sm font-semibold">Features</h3>
      <ul className="space-y-1.5">
        {features.map((feature, i) => {
          const colon = feature.indexOf(":");
          const hasLabel = colon > 0 && colon < 40;
          const label = hasLabel ? feature.slice(0, colon) : null;
          const body = hasLabel ? feature.slice(colon + 1).trim() : feature;

          return (
            <li key={i} className="flex gap-2 text-sm text-muted-foreground">
              <Check
                className="mt-0.5 size-4 shrink-0 text-foreground/60"
                aria-hidden
              />
              <span>
                {label && (
                  <span className="font-medium text-foreground">{label}: </span>
                )}
                {body}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
