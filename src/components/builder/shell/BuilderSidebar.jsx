import { AddPanel, StatsPanel } from '@/components/builder/panels'

export function BuilderSidebar({ items, addActions }) {
  return (
    <aside className="hidden lg:flex lg:flex-col w-64 shrink-0 min-h-0 border-l border-ink-100 pl-6 py-6">
      <div className="flex-1 overflow-y-auto min-h-0 space-y-4 pr-0.5">
        <AddPanel {...addActions} />
        {items.length > 0 && <StatsPanel items={items} />}
      </div>
    </aside>
  )
}
