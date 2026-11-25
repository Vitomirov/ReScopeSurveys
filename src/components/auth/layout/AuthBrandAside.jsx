import { Check } from 'lucide-react'

export function AuthHighlightList({ items, tone = 'dark', className = '' }) {
  const text = tone === 'dark' ? 'text-white/90' : 'text-ink-600'
  const mark = tone === 'dark' ? 'text-brand-200' : 'text-brand-600'
  const spacing = tone === 'dark' ? 'mt-8 space-y-3' : 'mt-3 space-y-2'
  return (
    <ul className={`${spacing} ${className}`.trim()}>
      {items.map(item => (
        <li key={item} className={`flex gap-2.5 text-sm leading-snug ${text}`}>
          <Check size={16} strokeWidth={2.5} className={`shrink-0 mt-0.5 ${mark}`} aria-hidden />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  )
}

const ASIDE_CLASS =
  'relative hidden lg:flex lg:w-[min(460px,44vw)] xl:w-[500px] shrink-0 flex-col justify-between overflow-hidden bg-gradient-to-br from-brand-700 via-brand-800 to-ink-900 text-white p-12 xl:p-16'

export function AuthBrandAside({ ariaLabel, eyebrow, title, detail, highlights, footerNote, children }) {
  return (
    <aside className={ASIDE_CLASS} aria-label={ariaLabel}>
      <div
        className="pointer-events-none absolute -left-16 -top-20 h-64 w-64 rounded-full bg-white/[0.06]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-24 -left-12 h-72 w-72 rounded-full bg-brand-500/20 blur-3xl"
        aria-hidden
      />
      <div className="relative">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-brand-100/90">{eyebrow}</p>
        <h2 className="mt-3 text-3xl xl:text-[2rem] font-bold leading-tight text-white">{title}</h2>
        {children}
        {detail ? (
          <p className="mt-5 max-w-sm text-sm leading-relaxed text-brand-50/90">{detail}</p>
        ) : null}
        {highlights?.length ? <AuthHighlightList items={highlights} tone="dark" /> : null}
      </div>
      {footerNote ? (
        <div className="relative mt-10 border-t border-white/10 pt-8">
          <p className="text-xs leading-relaxed text-brand-100/80">{footerNote}</p>
        </div>
      ) : null}
    </aside>
  )
}

export function AuthBrandCompact({ ariaLabel, eyebrow, title, detail, highlights, children }) {
  return (
    <div
      className="lg:hidden rounded-xl border border-brand-200/80 bg-gradient-to-r from-brand-50 to-white p-5 shadow-sm"
      aria-label={ariaLabel}
    >
      <p className="text-[10px] font-bold uppercase tracking-wide text-brand-700">{eyebrow}</p>
      <p className="mt-1 text-base font-bold text-ink-800">{title}</p>
      {detail ? <p className="mt-2 text-xs leading-relaxed text-ink-500">{detail}</p> : null}
      {children}
      {highlights?.length ? (
        <AuthHighlightList items={highlights} tone="light" className={children ? 'mt-3' : ''} />
      ) : null}
    </div>
  )
}
