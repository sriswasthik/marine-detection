import { Check, Minus } from 'lucide-react'
import { useEffect, useId, useRef, type ComponentPropsWithRef, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

export interface CheckboxProps extends Omit<ComponentPropsWithRef<'input'>, 'type' | 'size'> {
  label: ReactNode
  description?: ReactNode
  /** Mixed state, for example "some layers visible". */
  indeterminate?: boolean
  /** `sm`: a 13px label, for dense panels. */
  size?: 'md' | 'sm'
}

export function Checkbox({
  label,
  description,
  indeterminate = false,
  size = 'md',
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
    <div className={cn('flex items-start gap-3', className)}>
      {/* A second label for the same input, so its 40px touch hit area toggles it. */}
      <label
        htmlFor={inputId}
        className="hit-area relative inline-flex h-5 w-4 shrink-0 items-center"
      >
        <input
          ref={inputRef}
          id={inputId}
          type="checkbox"
          disabled={disabled}
          aria-describedby={descriptionId}
          aria-checked={indeterminate ? 'mixed' : undefined}
          className={cn(
            'peer size-4 cursor-pointer appearance-none rounded-tag border border-rule bg-white',
            'transition-colors duration-[120ms] ease-out hover:border-ink',
            'checked:border-ink checked:bg-ink indeterminate:border-ink indeterminate:bg-ink',
            'disabled:cursor-not-allowed disabled:opacity-50',
          )}
          {...rest}
        />
        <Check
          aria-hidden
          strokeWidth={3}
          className="pointer-events-none absolute inset-0 m-auto size-3 text-white opacity-0 peer-checked:opacity-100 peer-indeterminate:opacity-0"
        />
        <Minus
          aria-hidden
          strokeWidth={3}
          className="pointer-events-none absolute inset-0 m-auto size-3 text-white opacity-0 peer-indeterminate:opacity-100"
        />
      </label>
      <span className="flex min-w-0 flex-col">
        <label
          htmlFor={inputId}
          className={cn(
            size === 'sm' ? 'text-small text-ink' : 'text-body text-ink',
            disabled ? 'cursor-not-allowed text-ink-2' : 'cursor-pointer',
          )}
        >
          {label}
        </label>
        {description ? (
          <span id={descriptionId} className="text-small text-ink-2">
            {description}
          </span>
        ) : null}
      </span>
    </div>
  )
}
