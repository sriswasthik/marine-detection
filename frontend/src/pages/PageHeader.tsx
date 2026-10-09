import type { ReactNode } from 'react'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'

/** Page title (the page's only h1, 32px) with one lead line. Also sets the tab title. */
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
    <header className="flex flex-col gap-2">
      {meta ? <p className="data text-ink-2">{meta}</p> : null}
      <h1 className="display text-page text-tar">{title}</h1>
      <p className="max-w-[68ch] text-lead text-ink-2">{description}</p>
    </header>
  )
}

/** Document page frame: 1280px content on the 12-column grid, 16, 24 or 32px margins. */
export function PageContainer({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-page px-4 py-8 sm:px-6 lg:px-8 lg:py-12">{children}</div>
  )
}
