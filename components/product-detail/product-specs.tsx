import type { ProductSpec } from "@/lib/catalog";

export function ProductSpecs({ specs }: { specs: ProductSpec[] }) {
  if (specs.length === 0) return null;

  return (
    <section>
      <h3 className="mb-2 text-sm font-semibold">Specifications</h3>
      <dl className="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
        {specs.map((spec) => (
          <div
            key={spec.label}
            className="flex justify-between gap-3 border-b border-dashed py-1.5 text-sm"
          >
            <dt className="text-muted-foreground">{spec.label}</dt>
            <dd className="text-right font-medium">{spec.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
