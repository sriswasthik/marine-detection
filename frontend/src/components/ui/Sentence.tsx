import { createContext, useContext, type ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { Figure, type FigureProps, type FigureSize } from './Figure'

const SentenceSize = createContext<FigureSize>('figure')

export interface SentenceProps {
  children: ReactNode
  /** `figure` (56px numbers) on its own; `page` (32px) in tight spaces such as a side column. */
  size?: Extract<FigureSize, 'figure' | 'page'>
  className?: string
}

/**
 * Signature element 5: a headline result written as a sentence, the numbers set large inside it.
 * "<SentenceFigure value={42} /> possible debris regions covering …". Words are lead text.
 */
export function Sentence({ children, size = 'figure', className }: SentenceProps) {
  return (
    <SentenceSize value={size}>
      <p
        className={cn(
          'max-w-[44rem] text-lead text-ink',
          size === 'figure' ? 'leading-[4rem]' : 'leading-10',
          className,
        )}
      >
        {children}
      </p>
    </SentenceSize>
  )
}

/** A number inside a Sentence, at the sentence's figure size. */
export function SentenceFigure(props: Omit<FigureProps, 'size'>) {
  const size = useContext(SentenceSize)
  return <Figure {...props} size={size} />
}
