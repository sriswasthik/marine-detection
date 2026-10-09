import { useRef, type KeyboardEvent, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

export interface SegmentedOption<T extends string> {
  value: T
  label: ReactNode
  icon?: ReactNode
  disabled?: boolean
}

export interface SegmentedControlProps<T extends string> {
  /** Accessible name of the group. */
  label: string
  options: readonly SegmentedOption<T>[]
  value: T
  onChange: (value: T) => void
  size?: 'sm' | 'md'
  className?: string
}

/**
 * Single choice among a few options, as a radio group. Arrow keys move and select,
 * Home and End jump to the ends, disabled options are skipped.
 */
export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
  size = 'md',
  className,
}: SegmentedControlProps<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const enabled = options.map((o, i) => (o.disabled ? -1 : i)).filter((i) => i >= 0)
  const selectedIndex = options.findIndex((o) => o.value === value)
  const tabStop =
    selectedIndex >= 0 && !options[selectedIndex]?.disabled ? selectedIndex : enabled[0]

  const select = (index: number | undefined) => {
    if (index === undefined) return
    const option = options[index]
    if (!option || option.disabled) return
    onChange(option.value)
    refs.current[index]?.focus()
  }

  const onKeyDown = (event: KeyboardEvent, index: number) => {
    const position = enabled.indexOf(index)
    const step = (delta: number) => enabled[(position + delta + enabled.length) % enabled.length]
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        event.preventDefault()
        select(step(1))
        break
      case 'ArrowLeft':
      case 'ArrowUp':
        event.preventDefault()
        select(step(-1))
        break
      case 'Home':
        event.preventDefault()
        select(enabled[0])
        break
      case 'End':
        event.preventDefault()
        select(enabled[enabled.length - 1])
        break
    }
  }

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn(
        'inline-flex max-w-full overflow-hidden rounded-control border border-rule',
        className,
      )}
    >
      {options.map((option, index) => {
        const checked = option.value === value
        return (
          <button
            key={option.value}
            ref={(el) => {
              refs.current[index] = el
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            disabled={option.disabled}
            tabIndex={index === tabStop ? 0 : -1}
            onClick={() => select(index)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={cn(
              'inline-flex min-w-0 items-center justify-center gap-2 font-medium whitespace-nowrap',
              'border-l border-hairline first:border-l-0',
              'transition-colors duration-[120ms] ease-out [&_svg]:size-4 [&_svg]:shrink-0',
              'disabled:cursor-not-allowed disabled:opacity-50',
              // Inside the 1px frame: 32px and 36px overall, like buttons; 40px on phones.
              // Inside the 1px frame: 32px and 36px overall, like buttons; 40px on phones.
              size === 'sm' ? 'h-[30px] px-3 text-small' : 'h-[34px] px-3 text-body',
              'max-sm:h-[38px]',
              checked
                ? 'bg-sheet text-tar shadow-[inset_0_-2px_0_var(--color-ink)]'
                : 'text-ink-2 hover:bg-sheet hover:text-ink',
            )}
          >
            {option.icon}
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
