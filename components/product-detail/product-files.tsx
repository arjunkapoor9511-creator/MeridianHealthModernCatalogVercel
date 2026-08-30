import { FileText } from "lucide-react";

import { formatFileSize, type ProductFile } from "@/lib/catalog";

/** Flyer / manual etc. Plain links so the browser opens the PDF in a new tab. */
export function ProductFiles({ files }: { files: ProductFile[] }) {
  if (files.length === 0) return null;

  return (
    <section>
      <h3 className="mb-2 text-sm font-semibold">Documents</h3>
      <ul className="space-y-1.5">
        {files.map((file) => {
          const size = formatFileSize(file.sizeBytes);
          return (
            <li key={file.url}>
              <a
                href={file.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition hover:bg-muted"
              >
                <FileText
                  className="size-4 shrink-0 text-muted-foreground"
                  aria-hidden
                />
                <span className="font-medium">{file.label}</span>
                {size && (
                  <span className="text-xs text-muted-foreground">{size}</span>
                )}
              </a>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
