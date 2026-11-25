import { APP_SHELL_MAX_WIDTH } from '@/constants/ui/layout'
import { AppBackSlot } from '@/components/shared/layout/AppLeadingZone.jsx'

export const APP_SHELL_PADDING = 'px-4 sm:px-6 lg:px-8'

/** Back column + main pane (logo and content share the main pane left edge). */
export const APP_SHELL_GRID =
  'grid grid-cols-[auto_1fr] grid-rows-[minmax(0,1fr)] gap-x-2 sm:gap-x-3 md:gap-x-4 lg:gap-x-6 min-h-0'

/** Body grid: full-width on small screens; main pane aligns with logo from md up. */
export const APP_BODY_GRID =
  'grid grid-cols-1 md:grid-cols-[auto_1fr] grid-rows-[minmax(0,1fr)] md:gap-x-4 lg:gap-x-6 min-h-0'

export const APP_MAIN_PANE =
  'min-w-0 md:border-l md:border-ink-200 md:pl-4 lg:pl-6'

/** Builder main pane — no divider; content edge aligns with grid column. */
export const APP_BUILDER_PANE = 'min-w-0'

/** App header — logo left, primary actions + account cluster flush right. */
export const APP_HEADER_ROW =
  'flex items-center gap-2 sm:gap-3 min-w-0 w-full'

/** App header pane — spans full grid width on phones (back slot is hidden until md). */
export const APP_HEADER_PANE =
  `${APP_BUILDER_PANE} col-span-2 md:col-span-1 ${APP_HEADER_ROW}`

export const APP_HEADER_ACTIONS =
  'ml-auto flex items-center justify-end gap-1.5 sm:gap-3 min-w-0 shrink-0'

export const APP_HEADER_USER_CLUSTER =
  'flex items-center gap-0.5 sm:gap-1.5 shrink-0 sm:border-l sm:border-ink-200/80 sm:pl-2 sm:ml-0.5'

export function AppShell({ children, className = '' }) {
  return (
    <div
      className={`mx-auto w-full ${APP_SHELL_PADDING} ${className}`}
      style={{ maxWidth: APP_SHELL_MAX_WIDTH }}
    >
      {children}
    </div>
  )
}

/** @deprecated Use AppShell */
export const AppBuilderShell = AppShell

/** @deprecated Use APP_SHELL_GRID */
export const APP_BUILDER_GRID = APP_SHELL_GRID

export function AppAlignedBody({
  children,
  className = '',
  gridClassName = '',
  paneClassName = '',
  showBack = false,
  onBack,
  withDivider = true,
}) {
  const paneBase = withDivider ? APP_MAIN_PANE : APP_BUILDER_PANE

  return (
    <AppShell className={className}>
      <div className={`${APP_BODY_GRID} ${gridClassName}`}>
        <div className="hidden md:contents">
          <AppBackSlot
            showBack={showBack}
            onBack={onBack}
            className="invisible pointer-events-none"
            aria-hidden="true"
          />
        </div>
        <div className={`${paneBase} min-h-0 ${paneClassName}`}>
          {children}
        </div>
      </div>
    </AppShell>
  )
}
