"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from "@/components/ui/carousel";
import { cn } from "@/lib/utils";
import type { ProductImage } from "@/lib/catalog";

// The dialog's gallery column is ~28rem on desktop, near full width on mobile.
const IMAGE_SIZES = "(min-width: 768px) 28rem, 90vw";

export function ProductGallery({ images }: { images: ProductImage[] }) {
  const [api, setApi] = useState<CarouselApi>();
  const [selected, setSelected] = useState(0);

  useEffect(() => {
    if (!api) return;
    const onSelect = () => setSelected(api.selectedScrollSnap());
    onSelect();
    api.on("select", onSelect);
    return () => {
      api.off("select", onSelect);
    };
  }, [api]);

  const single = images.length <= 1;

  return (
    <div className="flex flex-col gap-3">
      <Carousel
        setApi={setApi}
        opts={{ loop: !single, watchDrag: !single }}
        className="w-full"
      >
        <CarouselContent>
          {images.map((img, i) => (
            <CarouselItem key={img.url}>
              <div className="relative aspect-square overflow-hidden rounded-lg border bg-white">
                <Image
                  src={img.url}
                  alt={img.alt}
                  fill
                  sizes={IMAGE_SIZES}
                  priority={i === 0}
                  className="object-contain p-4"
                />
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
        {!single && (
          <>
            <CarouselPrevious className="left-2" />
            <CarouselNext className="right-2" />
          </>
        )}
      </Carousel>

      {!single && (
        <div
          className="flex flex-wrap gap-2"
          role="tablist"
          aria-label="Product images"
        >
          {images.map((img, i) => (
            <button
              key={img.url}
              type="button"
              role="tab"
              aria-selected={i === selected}
              aria-label={`Show image ${i + 1} of ${images.length}`}
              onClick={() => api?.scrollTo(i)}
              className={cn(
                "relative size-14 shrink-0 overflow-hidden rounded-md border bg-white transition",
                i === selected
                  ? "ring-2 ring-ring ring-offset-1"
                  : "opacity-60 hover:opacity-100",
              )}
            >
              <Image
                src={img.url}
                alt=""
                fill
                sizes="56px"
                className="object-contain p-1"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
