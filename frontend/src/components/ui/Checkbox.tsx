import { Check, Minus } from 'lucide-react'
import { useEffect, useId, useRef, type ComponentPropsWithRef, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

export interface CheckboxProps extends Omit<ComponentPropsWithRef<'input'>, 'type' | 'size'> {
  label: ReactNode
  description?: ReactNode
  /** Mixed state, for example "some layers visible". */
  indeterminate?: boolean
}

export function Checkbox({
  label,
  description,
  indeterminate = false,
  className,
  id,
  disabled,
  ...rest
}: CheckboxProps) {
  const generated = useId()
  const inputId = id ?? generated
  const descriptionId = description ? `${inputId}-description` : undefined
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (inputRef.current) inputRef.current.indeterminate = indeterminate
  }, [indeterminate])

  return (
    <div className={cn('flex items-start gap-2.5', className)}>
      <span className="relative mt-0.5 inline-flex size-4 shrink-0">
        <input
          ref={inputRef}
          id={inputId}
          type="checkbox"
          disabled={disabled}
          aria-describedby={descriptionId}
          aria-checked={indeterminate ? 'mixed' : undefined}
          className={cn(
            'peer size-4 cursor-pointer appearance-none rounded-[4px] border border-border-strong bg-surface',
            'transition-colors duration-150 ease-out hover:border-ink-muted',
            'checked:border-accent checked:bg-accent indeterminate:border-accent indeterminate:bg-accent',
            'disabled:cursor-not-allowed disabled:opacity-50',
          )}
          {...rest}
        />
        <Check
          aria-hidden
          strokeWidth={3}
          className="pointer-events-none absolute inset-0.5 size-3 text-white opacity-0 peer-checked:opacity-100 peer-indeterminate:opacity-0"
        />
        <Minus
          aria-hidden
          strokeWidth={3}
          className="pointer-events-none absolute inset-0.5 size-3 text-white opacity-0 peer-indeterminate:opacity-100"
        />
      </span>
      <span className="flex min-w-0 flex-col">
        <label
          htmlFor={inputId}
          className={cn(
            'text-body text-ink',
            disabled ? 'cursor-not-allowed text-ink-muted' : 'cursor-pointer',
          )}
        >
          {label}
        </label>
        {description ? (
          <span id={descriptionId} className="text-caption text-ink-muted">
            {description}
          </span>
        ) : null}
      </span>
    </div>
  )
}
