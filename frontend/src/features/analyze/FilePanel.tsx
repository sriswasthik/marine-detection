import { FileImage, RefreshCw } from 'lucide-react'
import { Badge, Button, Skeleton } from '@/components/ui'
import { formatInteger } from '@/lib/format'
import type { DraftFile } from './draft'
import { fileExtension } from './validate'

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${formatInteger(bytes)} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

/**
 * The chosen file: a downsampled preview when one could be made, otherwise a calm file card.
 * A preview problem never blocks the user.
 */
export function FilePanel({
  draftFile,
  onReplace,
}: {
  draftFile: DraftFile
  onReplace: () => void
}) {
  const { facts, inspection, inspecting } = draftFile
  const preview = inspection?.previewUrl ?? null

  return (
    <section aria-label="Chosen image" className="flex flex-col gap-3">
      <div className="overflow-hidden rounded-card border border-border bg-surface">
        {inspecting ? (
          <Skeleton className="aspect-[4/3] w-full rounded-none" />
        ) : preview ? (
          <img
            src={preview}
            alt={`Preview of ${facts.name}`}
            className="aspect-[4/3] w-full bg-bg object-contain"
          />
        ) : (
          <div className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-3 bg-bg px-6 text-center">
            <FileImage aria-hidden className="size-8 text-ink-muted" strokeWidth={1.5} />
            <p className="text-small text-ink-muted">
              {draftFile.kind === 'sample'
                ? 'Sample scene. No image file is needed; the results come from sample data.'
                : 'Preview is generated after upload.'}
            </p>
          </div>
        )}
      </div>
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-small font-medium text-ink">{facts.name}</p>
          <p className="num text-caption text-ink-muted">
            {draftFile.kind === 'sample'
              ? 'Sample scene'
              : `${formatBytes(facts.size)} · ${fileExtension(facts.name).slice(1).toUpperCase() || 'Unknown type'}`}
            {inspection?.width && inspection.height
              ? ` · ${formatInteger(inspection.width)} × ${formatInteger(inspection.height)} px`
              : ''}
          </p>
        </div>
        {draftFile.kind === 'sample' ? <Badge tone="warning">Sample data</Badge> : null}
        <Button variant="ghost" size="sm" iconStart={<RefreshCw aria-hidden />} onClick={onReplace}>
          Choose another file
        </Button>
      </div>
    </section>
  )
}
