import { ChevronDown } from 'lucide-react'
import type { ComponentPropsWithRef, ReactNode } from 'react'
import { Field } from './Field'
import { inputStyles } from './inputStyles'

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

/** Native select (reliable keyboard, screen reader and mobile behaviour), underlined like inputs. */
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
            className={inputStyles({
              invalid,
              size,
              className: 'cursor-pointer appearance-none pr-8',
            })}
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
            className="pointer-events-none absolute top-1/2 right-0 size-4 -translate-y-1/2 text-ink-2"
          />
        </div>
      )}
    </Field>
  )
}
