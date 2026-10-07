import type { ComponentPropsWithRef, ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { Field } from './Field'

export interface TextInputProps extends Omit<ComponentPropsWithRef<'input'>, 'size'> {
  label: ReactNode
  hint?: ReactNode
  /** Says what is wrong and how to fix it. */
  error?: ReactNode
  hideLabel?: boolean
  size?: 'sm' | 'md'
  /** Monospace and tabular figures, for coordinates. */
  numeric?: boolean
}

/** Labelled text input (also number, date and datetime-local). */
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
          className={cn(
            'w-full rounded-control border bg-surface px-3 text-ink shadow-subtle placeholder:text-ink-muted/70',
            'transition-colors duration-150 ease-out hover:border-ink-muted/60',
            'disabled:cursor-not-allowed disabled:bg-bg disabled:text-ink-muted',
            size === 'sm' ? 'h-8 text-small' : 'h-9 text-body',
            numeric && 'num font-mono text-small',
            invalid ? 'border-danger' : 'border-border-strong',
          )}
          {...rest}
        />
      )}
    </Field>
  )
}
