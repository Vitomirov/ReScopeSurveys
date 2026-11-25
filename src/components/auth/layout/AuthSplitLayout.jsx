import { AppLogo } from '@/components/shared/branding/AppLogo.jsx'

export function AuthSplitLayout({
  aside,
  mobileBanner,
  title,
  subtitle,
  introExtra,
  form,
  footer,
  onGoHome,
}) {
  return (
    <div className="min-h-screen min-h-[100dvh] flex flex-col lg:flex-row bg-white safe-top safe-bottom">
      {aside}
      <div className="flex-1 flex flex-col lg:justify-center px-5 py-6 sm:px-10 lg:px-12 xl:px-16 lg:py-12 overflow-y-auto">
        <div className="w-full max-w-md sm:max-w-xl mx-auto pb-6">
          <header className="flex items-center justify-between gap-4 mb-6 lg:mb-10">
            <AppLogo size="md" className="w-[140px] sm:w-[160px]" onClick={onGoHome} />
            {onGoHome && (
              <button
                type="button"
                onClick={onGoHome}
                className="text-sm font-medium text-ink-500 hover:text-brand-700 shrink-0"
              >
                Back to site
              </button>
            )}
          </header>

          {mobileBanner}

          <div className={mobileBanner ? 'mt-6 lg:mt-0' : undefined}>
            <h1 className="text-xl sm:text-2xl font-bold text-ink-900 tracking-tight text-center lg:text-left">
              {title}
            </h1>
            {subtitle ? (
              <p className="mt-2 text-sm text-ink-500 text-center lg:text-left leading-relaxed">{subtitle}</p>
            ) : null}
            {introExtra ? (
              <div className="mt-3 text-center lg:text-left">{introExtra}</div>
            ) : null}
          </div>

          <div className="mt-6">{form}</div>
          {footer ? <div className="text-center lg:text-left">{footer}</div> : null}
        </div>
      </div>
    </div>
  )
}
