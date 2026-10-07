import { ChevronDown } from 'lucide-react'
import type { ComponentPropsWithRef, ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { Field } from './Field'

export interface SelectOption {
  value: string
  label: string
  disabled?: boolean
}

export interface SelectOptionGroup {
  label: string
  options: readonly SelectOption[]
}

export interface SelectProps extends Omit<ComponentPropsWithRef<'select'>, 'size' | 'children'> {
  label: ReactNode
  options?: readonly SelectOption[]
  /** Grouped options, rendered as optgroups after any ungrouped options. */
  groups?: readonly SelectOptionGroup[]
  hint?: ReactNode
  error?: ReactNode
  hideLabel?: boolean
  size?: 'sm' | 'md'
  /** Shown as a disabled first option when no value is chosen. */
  placeholder?: string
}

/** Native select for reliable keyboard, screen reader and mobile behaviour. */
export function Select({
  label,
  options = [],
  groups = [],
  hint,
  error,
  hideLabel,
  size = 'md',
  placeholder,
  className,
  id,
  ...rest
}: SelectProps) {
  return (
    <Field
      label={label}
      hint={hint}
      error={error}
      hideLabel={hideLabel}
      id={id}
      className={className}
    >
      {({ id: controlId, describedBy, invalid }) => (
        <div className="relative">
          <select
            id={controlId}
            aria-describedby={describedBy}
            aria-invalid={invalid || undefined}
            className={cn(
              'w-full appearance-none rounded-control border bg-surface pr-9 pl-3 text-ink shadow-subtle',
              'transition-colors duration-150 ease-out hover:border-ink-muted/60',
              'disabled:cursor-not-allowed disabled:bg-bg disabled:text-ink-muted',
              size === 'sm' ? 'h-8 text-small' : 'h-9 text-body',
              invalid ? 'border-danger' : 'border-border-strong',
            )}
            {...rest}
          >
            {placeholder ? (
              <option value="" disabled>
                {placeholder}
              </option>
            ) : null}
            {options.map((option) => (
              <option key={option.value} value={option.value} disabled={option.disabled}>
                {option.label}
              </option>
            ))}
            {groups.map((group) => (
              <optgroup key={group.label} label={group.label}>
                {group.options.map((option) => (
                  <option key={option.value} value={option.value} disabled={option.disabled}>
                    {option.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <ChevronDown
            aria-hidden
            className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-ink-muted"
          />
        </div>
      )}
    </Field>
  )
}
