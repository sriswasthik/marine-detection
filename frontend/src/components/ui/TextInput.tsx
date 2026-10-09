import type { ComponentPropsWithRef, ReactNode } from 'react'
import { Field } from './Field'
import { inputStyles } from './inputStyles'

export interface TextInputProps extends Omit<ComponentPropsWithRef<'input'>, 'size'> {
  label: ReactNode
  hint?: ReactNode
  /** Says what is wrong and how to fix it. */
  error?: ReactNode
  hideLabel?: boolean
  size?: 'sm' | 'md'
  /** Mono and tabular figures, for coordinates. */
  numeric?: boolean
}

/** A Field with an underlined text input (also number, date and datetime-local). */
export function TextInput({
  label,
  hint,
  error,
  hideLabel,
  size = 'md',
  numeric = false,
  className,
  id,
  ...rest
}: TextInputProps) {
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
        <input
          id={controlId}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          className={inputStyles({ invalid, size, numeric })}
          {...rest}
        />
      )}
    </Field>
  )
}
