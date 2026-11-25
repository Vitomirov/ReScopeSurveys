import { memo } from 'react'
import { Trash2, GripVertical, FileText, ChevronDown, Clock } from 'lucide-react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { NavigationLockEditor } from '@/components/shared'
import { resolveNavigationLockSeconds } from '@/constants/survey/navigationLock'

export const PageBreakItem = memo(function PageBreakItem({
  item, pageNumber, dispatch, isActive, onActivateItem, allPagesLockEnabled = false,
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }

  const lockEnabled = !allPagesLockEnabled && resolveNavigationLockSeconds(item.navigationLock) > 0
  const showPerPageLock = !allPagesLockEnabled

  return (
    <div ref={setNodeRef} style={style}>
      <div className="flex items-center gap-2 py-1 group">
        {/* Drag handle */}
        <div {...attributes} {...listeners} className="drag-handle text-ink-200 hover:text-ink-400 transition-colors shrink-0">
          <GripVertical size={15} />
        </div>

        {/* Left line */}
        <div className="hidden sm:block flex-1 border-t-2 border-dashed border-ink-200" />

        {/* Page break badge */}
        {showPerPageLock ? (
          <button
            type="button"
            onClick={() => onActivateItem(item.id)}
            title="Page settings: timed navigation lock"
            className={`flex flex-wrap items-center justify-center gap-x-2 gap-y-1 px-3 py-2 bg-white border rounded-xl sm:rounded-full shadow-sm transition-all max-w-full min-w-0 ${
              isActive ? 'border-violet-400 ring-2 ring-violet-100' : 'border-ink-200'
            }`}
          >
            <FileText size={12} className="text-ink-400 shrink-0" />
            <span className="text-xs font-semibold text-ink-500 uppercase tracking-wider shrink-0">
              Page {pageNumber}
            </span>
            <div className="hidden sm:block w-px h-3 bg-ink-200 shrink-0" />
            <input
              type="text"
              value={item.title || ''}
              onChange={e => dispatch({ type: 'UPDATE_ITEM', id: item.id, patch: { title: e.target.value } })}
              placeholder="Page title (optional)"
              className="text-xs text-ink-500 bg-transparent border-none outline-none min-w-[7rem] flex-1 sm:flex-none sm:w-28 placeholder:text-ink-300"
              onClick={e => e.stopPropagation()}
            />
            {lockEnabled && (
              <span className="flex items-center gap-0.5 text-xs font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-full shrink-0">
                <Clock size={9} /> {item.navigationLock?.seconds ?? 0}s
              </span>
            )}
            <ChevronDown size={12} className={`text-ink-300 transition-transform shrink-0 ${isActive ? 'rotate-180' : ''}`} />
          </button>
        ) : (
          <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 px-3 py-2 bg-white border border-ink-200 rounded-xl sm:rounded-full shadow-sm max-w-full min-w-0">
            <FileText size={12} className="text-ink-400 shrink-0" />
            <span className="text-xs font-semibold text-ink-500 uppercase tracking-wider shrink-0">
              Page {pageNumber}
            </span>
            <div className="hidden sm:block w-px h-3 bg-ink-200 shrink-0" />
            <input
              type="text"
              value={item.title || ''}
              onChange={e => dispatch({ type: 'UPDATE_ITEM', id: item.id, patch: { title: e.target.value } })}
              placeholder="Page title (optional)"
              className="text-xs text-ink-500 bg-transparent border-none outline-none min-w-[7rem] flex-1 sm:flex-none sm:w-28 placeholder:text-ink-300"
            />
          </div>
        )}

        {/* Right line */}
        <div className="hidden sm:block flex-1 border-t-2 border-dashed border-ink-200" />

        {/* Delete */}
        <button
          onClick={() => dispatch({ type: 'DELETE_ITEM', id: item.id })}
          className="p-1.5 text-ink-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all opacity-100 sm:opacity-0 sm:group-hover:opacity-100 shrink-0"
          title="Remove page break"
        >
          <Trash2 size={13} />
        </button>
      </div>

      {!isActive && showPerPageLock && (
        <p className="text-center text-xs text-ink-400 mt-0.5 mb-1 px-8">
          Click page badge for timed navigation lock settings
        </p>
      )}

      {isActive && showPerPageLock && (
        <div className="mx-2 sm:ml-8 sm:mr-8 mb-2 mt-1">
          <NavigationLockEditor
            lock={item.navigationLock}
            onChange={navigationLock => dispatch({ type: 'UPDATE_ITEM', id: item.id, patch: { navigationLock } })}
            pageLabel={`Page ${pageNumber}`}
          />
        </div>
      )}
    </div>
  )
})
