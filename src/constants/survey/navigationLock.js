export const NAVIGATION_LOCK_DURATION_OPTIONS = [5, 10, 15, 20, 30, 45, 60, 90, 120]

export const DEFAULT_NAVIGATION_LOCK_SECONDS = 10

export const makeNavigationLock = () => ({
  enabled: false,
  seconds: DEFAULT_NAVIGATION_LOCK_SECONDS,
})

export function resolveNavigationLockSeconds(lock) {
  if (!lock?.enabled) return 0
  const seconds = Number(lock.seconds)
  return Number.isFinite(seconds) && seconds > 0 ? Math.round(seconds) : 0
}
