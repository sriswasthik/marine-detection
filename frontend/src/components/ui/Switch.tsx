import { useId, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

export interface SwitchProps {
  label: ReactNode
  description?: ReactNode
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  disabled?: boolean
  /** Put the switch after the label, for settings rows. */
  labelPosition?: 'start' | 'end'
  className?: string
  id?: string
}

/**
 * On/off setting that applies immediately. A square track with a square thumb that slides across;
 * on, the track is ink. After anonithrax's square toggle on uiverse.io (MIT).
 */
export function Switch({
  label,
  description,
  checked,
  onCheckedChange,
  disabled = false,
  labelPosition = 'end',
  className,
  id,
}: SwitchProps) {
  const generated = useId()
  const switchId = id ?? generated
  const descriptionId = description ? `${switchId}-description` : undefined

  // Centred on the label's first 20px line.
  const control = (
    <span className="flex h-5 shrink-0 items-center">
      <button
        id={switchId}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-describedby={descriptionId}
        disabled={disabled}
        onClick={() => onCheckedChange(!checked)}
        className={cn(
          'hit-area relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center border',
          'transition-colors duration-[160ms] ease-out',
          'disabled:cursor-not-allowed disabled:opacity-50',
          checked ? 'border-ink bg-ink' : 'border-rule bg-hairline',
        )}
      >
        <span
          aria-hidden
          className={cn(
            'absolute top-0.5 left-0.5 size-3.5 bg-white transition-transform duration-[160ms] ease-out',
            checked ? 'translate-x-4' : 'shadow-[0_0_0_1px_var(--color-rule)]',
          )}
        />
      </button>
    </span>
  )

  const text = (
    <span className="flex min-w-0 flex-1 flex-col">
      <label
        htmlFor={switchId}
        className={cn(
          'text-body text-ink',
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
  )

  return (
    <div className={cn('flex items-start gap-3', className)}>
      {labelPosition === 'end' ? control : text}
      {labelPosition === 'end' ? text : control}
    </div>
  )
}
