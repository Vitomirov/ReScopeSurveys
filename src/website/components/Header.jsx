import { useCallback, useEffect, useId, useState } from 'react'
import { Menu, X } from 'lucide-react'
import logoLgUrl from '@/assets/brand/logo-lg.svg'
import logoSmUrl from '@/assets/brand/logo-sm.svg'
import { APP_NAME } from '@/constants/ui/branding'
import { MARKETING_NAV } from '../content/marketingContent'
import { resolveCta, runCtaAction } from '../cta'
import { Button } from './Button'

export function Header({ isAuthenticated, onNavHash }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuId = useId()
  const primary = isAuthenticated ? MARKETING_NAV.signedInPrimaryCta : MARKETING_NAV.primaryCta

  const closeMenu = useCallback(() => setMenuOpen(false), [])

  const navigate = (hash) => {
    onNavHash(hash)
    closeMenu()
  }

  useEffect(() => {
    if (!menuOpen) return
    const onKey = (e) => {
      if (e.key === 'Escape') closeMenu()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [menuOpen, closeMenu])

  useEffect(() => {
    const onResize = () => {
      if (window.matchMedia('(min-width: 1024px)').matches) closeMenu()
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [closeMenu])

  return (
    <header>
      <div className="wrap nav">
        <button type="button" className="nav-brand" onClick={() => navigate('#top')} aria-label={`${APP_NAME} home`}>
          <img src={logoSmUrl} alt="" className="nav-logo-sm" draggable={false} />
          <img src={logoLgUrl} alt={APP_NAME} className="nav-logo-lg" draggable={false} />
        </button>

        <nav className="navlinks" aria-label="Primary">
          {MARKETING_NAV.links.map(link => (
            <button key={link.hash} type="button" onClick={() => navigate(link.hash)}>
              {link.label}
            </button>
          ))}
        </nav>

        <div className="nav-actions">
          {!isAuthenticated && (
            <button
              type="button"
              className="nav-signin"
              onClick={() => runCtaAction(resolveCta(MARKETING_NAV.signInCta.ctaId), { isAuthenticated })}
            >
              {MARKETING_NAV.signInCta.label}
            </button>
          )}
          <Button
            ctaId={primary.ctaId}
            label={primary.label}
            variant="primary"
            className="btn-nav-cta nav-header-cta"
            isAuthenticated={isAuthenticated}
          />

          <div className="nav-menu">
            <button
              type="button"
              className="nav-menu-toggle"
              aria-expanded={menuOpen}
              aria-controls={menuId}
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              onClick={() => setMenuOpen(v => !v)}
            >
              {menuOpen ? <X size={22} strokeWidth={2.25} aria-hidden /> : <Menu size={22} strokeWidth={2.25} aria-hidden />}
            </button>
            <div
              id={menuId}
              className={`nav-menu-panel${menuOpen ? ' nav-menu-panel--open' : ''}`}
              hidden={!menuOpen}
            >
              <nav aria-label="Site sections">
                {isAuthenticated && (
                  <button
                    type="button"
                    onClick={() => {
                      runCtaAction(resolveCta('dashboard'), { isAuthenticated: true })
                      closeMenu()
                    }}
                  >
                    Go to dashboard
                  </button>
                )}
                {MARKETING_NAV.links.map(link => (
                  <button key={link.hash} type="button" onClick={() => navigate(link.hash)}>
                    {link.label}
                  </button>
                ))}
              </nav>
            </div>
          </div>
        </div>
      </div>
      {menuOpen ? (
        <button type="button" className="nav-menu-scrim" aria-label="Close menu" onClick={closeMenu} />
      ) : null}
    </header>
  )
}
