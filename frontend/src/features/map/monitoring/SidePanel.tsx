import { ChevronsLeft, ChevronsRight, Layers, ListOrdered, X } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { ArrowLink, IconButton, Tabs } from '@/components/ui'
import { cn } from '@/lib/cn'

export type SidePanelTab = 'inspect' | 'layers'

export interface SidePanelProps {
  inspect: ReactNode
  layers: ReactNode
  /** Caveats about the result, above the ledger. */
  notices?: ReactNode
  /** The next screen, at the bottom: "Next: view evidence". */
  next: { label: string; to: string }
  /**
   * `docked`: a 288px column beside the map, collapsible to a 40px rail.
   * `slide-over`: under 1100px, a panel over the map's left edge, opened from the toolbar.
   */
  mode: 'docked' | 'slide-over'
  /** Slide-over only. */
  onClose?: () => void
}

/**
 * One panel with two underline tabs, "Inspect next" and "Layers", and the page's next step at
 * the bottom. Docked it collapses to a rail (160ms); under 1100px it slides over the map.
 */
export function SidePanel({ inspect, layers, notices, next, mode, onClose }: SidePanelProps) {
  const [tab, setTab] = useState<SidePanelTab>('inspect')
  const [collapsedState, setCollapsed] = useState(false)
  const collapsed = mode === 'docked' && collapsedState
  const open = (target: SidePanelTab) => {
    setTab(target)
    setCollapsed(false)
  }

  return (
    <aside
      aria-label="Map panel"
      data-chrome="side"
      className={cn(
        'flex min-h-0 flex-col overflow-hidden bg-sheet transition-[width] duration-[160ms] ease-out',
        collapsed ? 'w-10' : 'w-72',
        mode === 'docked'
          ? 'h-full border-r border-hairline'
          : 'absolute top-12 bottom-7 left-0 z-[700] max-w-full border-r border-rule shadow-popover',
      )}
    >
      {collapsed ? (
        <div className="flex flex-col items-center gap-1 py-2">
          <IconButton
            label="Show the panel"
            icon={<ChevronsRight aria-hidden />}
            size="sm"
            onClick={() => setCollapsed(false)}
          />
          <IconButton
            label="Inspect next"
            icon={<ListOrdered aria-hidden />}
            size="sm"
            onClick={() => open('inspect')}
          />
          <IconButton
            label="Layers"
            icon={<Layers aria-hidden />}
            size="sm"
            onClick={() => open('layers')}
          />
        </div>
      ) : (
        <>
          <div className="relative min-h-0 w-72 flex-1 overflow-y-auto px-4 pb-4">
            <div className="absolute top-1 right-2 z-10">
              {mode === 'docked' ? (
                <IconButton
                  label="Collapse the panel"
                  icon={<ChevronsLeft aria-hidden />}
                  size="sm"
                  onClick={() => setCollapsed(true)}
                />
              ) : (
                <IconButton
                  label="Close the panel"
                  icon={<X aria-hidden />}
                  size="sm"
                  onClick={onClose}
                />
              )}
            </div>
            <Tabs
              label="Map panel"
              value={tab}
              onValueChange={setTab}
              className="[&>[role=tablist]]:pr-10"
              panelClassName="pt-3"
              items={[
                {
                  value: 'inspect',
                  label: 'Inspect next',
                  content: (
                    <div className="flex flex-col gap-3">
                      {notices}
                      {inspect}
                    </div>
                  ),
                },
                { value: 'layers', label: 'Layers', content: layers },
              ]}
            />
          </div>
          <div className="w-72 shrink-0 border-t border-hairline px-4 py-1">
            <ArrowLink to={next.to} size="sm">
              {next.label}
            </ArrowLink>
          </div>
        </>
      )}
    </aside>
  )
}
