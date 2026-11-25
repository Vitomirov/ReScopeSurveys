import logoLgUrl from '@/assets/brand/logo-lg.svg'
import logoSmUrl from '@/assets/brand/logo-sm.svg'
import { APP_NAME } from '@/constants/ui/branding'

const HEIGHT = {
  sm: 'h-7',
  md: 'h-9',
  lg: 'h-11',
}

export function AppLogo({
  onClick,
  size = 'md',
  className = '',
  title = `Back to ${APP_NAME}`,
}) {
  const imgClass = `${HEIGHT[size]} w-auto object-contain object-left ${className}`

  const logos = (
    <span className="inline-flex items-center shrink-0">
      <img
        src={logoSmUrl}
        alt={APP_NAME}
        className={`${imgClass} md:hidden`}
        draggable={false}
      />
      <img
        src={logoLgUrl}
        alt={APP_NAME}
        className={`${imgClass} hidden md:block`}
        draggable={false}
      />
    </span>
  )

  if (!onClick) return logos

  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="inline-flex items-center shrink-0 rounded-lg hover:opacity-90 active:opacity-80 transition-opacity focus-ring"
    >
      {logos}
    </button>
  )
}
