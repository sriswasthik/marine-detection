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

/** On/off setting that applies immediately. */
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

  const control = (
    <button
      id={switchId}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-describedby={descriptionId}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        'relative mt-0.5 inline-flex h-[18px] w-8 shrink-0 cursor-pointer items-center rounded-full',
        'transition-colors duration-150 ease-out disabled:cursor-not-allowed disabled:opacity-50',
        checked ? 'bg-accent' : 'bg-border-strong',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'absolute top-[2px] left-[2px] size-[14px] rounded-full bg-surface shadow-subtle transition-transform duration-150 ease-out',
          checked && 'translate-x-[14px]',
        )}
      />
    </button>
  )

  const text = (
    <span className="flex min-w-0 flex-1 flex-col">
      <label
        htmlFor={switchId}
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
  )

  return (
    <div className={cn('flex items-start gap-2.5', className)}>
      {labelPosition === 'end' ? control : text}
      {labelPosition === 'end' ? text : control}
    </div>
  )
}
