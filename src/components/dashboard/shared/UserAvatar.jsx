/** Avatar with image or initials fallback — used in profile and team lists. */
export function UserAvatar({ user, size = 'md', className = '' }) {
  const label = user?.name || user?.username || '?'
  const initials = label.trim().slice(0, 2).toUpperCase()
  const sizes = {
    sm: 'w-9 h-9 text-xs',
    md: 'w-10 h-10 text-xs',
    lg: 'w-16 h-16 text-lg',
  }
  const dim = sizes[size] || sizes.md

  if (user?.avatarUrl) {
    return (
      <img
        src={user.avatarUrl}
        alt=""
        className={`${dim} rounded-full object-cover shrink-0 bg-ink-100 ${className}`}
      />
    )
  }

  return (
    <div
      className={`${dim} rounded-full bg-brand-100 flex items-center justify-center font-bold text-brand-600 shrink-0 ${className}`}
      aria-hidden
    >
      {initials[0]}
    </div>
  )
}

export default UserAvatar
