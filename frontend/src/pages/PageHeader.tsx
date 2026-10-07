import type { ReactNode } from 'react'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'

/** Page title (the page's only h1) with one supporting line. Also sets the tab title. */
export function PageHeader({
  title,
  description,
  meta,
}: {
  title: string
  description: ReactNode
  /** Small line above the title, for example an observation id. */
  meta?: ReactNode
}) {
  useDocumentTitle(title)
  return (
    <header className="flex flex-col gap-1">
      {meta ? <p className="mono-label text-ink-muted">{meta}</p> : null}
      <h1 className="text-title text-ink">{title}</h1>
      <p className="max-w-prose text-body text-ink-muted">{description}</p>
    </header>
  )
}

/** Standard page width and padding. */
export function PageContainer({ children }: { children: ReactNode }) {
  return <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:py-10">{children}</div>
}
