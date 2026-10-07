import { CircleAlert } from 'lucide-react'
import { useId, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

export interface FieldRenderProps {
  id: string
  labelId: string
  describedBy: string | undefined
  invalid: boolean
}

export interface FieldProps {
  label: ReactNode
  hint?: ReactNode
  /** Says what is wrong and how to fix it. */
  error?: ReactNode
  /** Visually hides the label; it stays available to assistive tech. */
  hideLabel?: boolean
  /** Shown at the right of the label, for example the current slider value. */
  aside?: ReactNode
  id?: string
  className?: string
  children: (props: FieldRenderProps) => ReactNode
}

/** Label, hint and error around one form control, wired with ids. */
export function Field({
  label,
  hint,
  error,
  hideLabel,
  aside,
  id,
  className,
  children,
}: FieldProps) {
  const generated = useId()
  const controlId = id ?? generated
  const hintId = hint ? `${controlId}-hint` : undefined
  const errorId = error ? `${controlId}-error` : undefined
  const labelId = `${controlId}-label`
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <div className={cn('flex items-baseline justify-between gap-3', hideLabel && 'sr-only')}>
        <label id={labelId} htmlFor={controlId} className="text-small font-medium text-ink">
          {label}
        </label>
        {aside ? <span className="num text-small text-ink-muted">{aside}</span> : null}
      </div>
      {children({ id: controlId, labelId, describedBy, invalid: Boolean(error) })}
      {hint ? (
        <p id={hintId} className="text-caption text-ink-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="flex items-start gap-1.5 text-caption text-danger">
          <CircleAlert className="mt-px size-3.5 shrink-0" aria-hidden />
          <span>{error}</span>
        </p>
      ) : null}
    </div>
  )
}
