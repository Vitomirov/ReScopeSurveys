import { memo } from 'react'
import { Trash2, GripVertical, ChevronDown, ChevronRight, Layers, GitBranch, Settings2, Clock } from 'lucide-react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { VisibilityEditor, NavigationLockEditor } from '@/components/shared'
import { visibilitySummary } from '@/utils/survey/engines/visibilityEngine'
import { resolveNavigationLockSeconds } from '@/constants/survey/navigationLock'

export const GroupItem = memo(function GroupItem({
  item, questionCount, dispatch, isActive, onActivateItem, availableQuestions = [], contextItems = [],
  allPagesLockEnabled = false,
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }

  const toggleCollapse = () =>
    dispatch({ type: 'UPDATE_ITEM', id: item.id, patch: { collapsed: !item.collapsed } })

  const visEnabled = item.visibility?.enabled
  const summary    = visEnabled ? visibilitySummary(item.visibility, availableQuestions) : null
  const lockEnabled = !allPagesLockEnabled && resolveNavigationLockSeconds(item.navigationLock) > 0

  return (
    <div ref={setNodeRef} style={style}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 px-3 py-2.5 bg-ink-800 rounded-xl group">
        {/* Drag handle */}
        <div {...attributes} {...listeners} className="drag-handle text-ink-500 hover:text-ink-300 transition-colors shrink-0">
          <GripVertical size={15} />
        </div>

        {/* Collapse toggle (builder-only display collapse) */}
        <button
          onClick={toggleCollapse}
          title="Collapse/expand in builder"
          className="text-ink-400 hover:text-white transition-colors shrink-0"
        >
          {item.collapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
        </button>

        <Layers size={14} className="text-ink-400 shrink-0" />

        {/* Group title */}
        <input
          type="text"
          value={item.title || ''}
          onChange={e => dispatch({ type: 'UPDATE_ITEM', id: item.id, patch: { title: e.target.value } })}
          placeholder="Group name..."
          className="flex-1 min-w-0 basis-[calc(100%-5.5rem)] sm:basis-auto bg-transparent border-none outline-none text-sm font-semibold text-white placeholder:text-ink-500"
          onClick={e => e.stopPropagation()}
        />

        {/* Conditional badge */}
        {visEnabled && (
          <span className="flex items-center gap-0.5 text-xs font-semibold text-violet-300 bg-violet-900/60 px-1.5 py-0.5 rounded-full shrink-0">
            <GitBranch size={9} /> <span className="hidden sm:inline">Conditional</span>
          </span>
        )}
        {lockEnabled && (
          <span className="flex items-center gap-0.5 text-xs font-semibold text-amber-200 bg-amber-900/50 px-1.5 py-0.5 rounded-full shrink-0">
            <Clock size={9} /> {item.navigationLock?.seconds ?? 0}s
          </span>
        )}

        {/* Question count badge */}
        <span className="text-xs text-ink-500 bg-ink-700 px-2 py-0.5 rounded-full shrink-0">
          {questionCount} Q{item.collapsed ? <span className="hidden sm:inline"> (hidden)</span> : ''}
        </span>

        {/* Visibility settings toggle */}
        <button
          onClick={() => onActivateItem(item.id)}
          title="Conditional visibility settings"
          className={`p-1.5 rounded-lg transition-all shrink-0 ${
            isActive ? 'text-violet-300 bg-violet-900/60' : 'text-ink-500 hover:text-violet-300 hover:bg-ink-700'
          }`}
        >
          <Settings2 size={13} />
        </button>

        {/* Delete */}
        <button
          onClick={() => dispatch({ type: 'DELETE_ITEM', id: item.id })}
          className="p-1.5 text-ink-500 hover:text-rose-400 hover:bg-ink-700 rounded-lg transition-all opacity-100 sm:opacity-0 sm:group-hover:opacity-100 shrink-0"
          title="Remove group (questions stay)"
        >
          <Trash2 size={13} />
        </button>
      </div>

      {/* Expanded group settings */}
      {isActive && (
        <div className="mt-1.5 mb-1 space-y-2">
          {!allPagesLockEnabled && (
            <NavigationLockEditor
              lock={item.navigationLock}
              onChange={navigationLock => dispatch({ type: 'UPDATE_ITEM', id: item.id, patch: { navigationLock } })}
              pageLabel={item.title || 'this section'}
            />
          )}
          {summary && (
            <p className="text-xs text-violet-800 italic mb-1.5 px-1">{summary}</p>
          )}
          <VisibilityEditor
            itemId={item.id}
            vis={item.visibility}
            availableQuestions={availableQuestions}
            contextItems={contextItems}
            dispatch={dispatch}
          />
        </div>
      )}
    </div>
  )
})
