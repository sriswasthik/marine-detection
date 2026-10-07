import { Upload } from 'lucide-react'
import { useId, useRef, useState, type DragEvent, type KeyboardEvent } from 'react'
import { cn } from '@/lib/cn'
import { ACCEPTED_EXTENSIONS, ACCEPTED_TYPES, MAX_UPLOAD_MB } from '@/lib/config'

const ACCEPT = [...Object.keys(ACCEPTED_TYPES), ...ACCEPTED_EXTENSIONS].join(',')

/**
 * Large, calm drop area. Drag a file in, click it, or focus it and press Enter or Space to
 * browse. Validation happens after a file is chosen, so any file is accepted here.
 */
export function UploadDropzone({
  onFile,
  className,
}: {
  onFile: (file: File) => void
  className?: string
}) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [dragging, setDragging] = useState(false)
  const helpId = useId()

  const browse = () => inputRef.current?.click()
  const take = (files: FileList | null) => {
    const file = files?.[0]
    if (file) onFile(file)
  }

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setDragging(false)
    take(event.dataTransfer.files)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      browse()
    }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-describedby={helpId}
      onClick={browse}
      onKeyDown={onKeyDown}
      onDragOver={(event) => {
        event.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      className={cn(
        'flex min-h-72 cursor-pointer flex-col items-center justify-center gap-4 rounded-card border border-dashed px-6 py-10 text-center',
        'transition-colors duration-150 ease-out',
        dragging
          ? 'border-accent bg-accent-soft'
          : 'border-border-strong bg-surface hover:border-ink-muted hover:bg-bg',
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          'flex size-11 items-center justify-center rounded-full border bg-surface',
          dragging ? 'border-accent text-accent' : 'border-border text-ink-muted',
        )}
      >
        <Upload className="size-5" strokeWidth={1.75} />
      </span>
      <div className="flex flex-col gap-1">
        <p className="text-heading text-ink">
          {dragging ? 'Drop the image to use it' : 'Drop an image here, or browse'}
        </p>
        <p id={helpId} className="max-w-sm text-small text-ink-muted">
          GeoTIFF with embedded georeferencing is best. PNG/JPG needs the geographic bounds entered
          below.
        </p>
      </div>
      <p className="text-caption text-ink-muted">
        .tif, .tiff, .png, .jpg up to {MAX_UPLOAD_MB} MB
      </p>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(event) => {
          take(event.target.files)
          event.target.value = ''
        }}
        onClick={(event) => event.stopPropagation()}
      />
    </div>
  )
}
