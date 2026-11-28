const STICKY_HEADER_OFFSET = 72

/** Nearest ancestor that actually scrolls (overflow auto/scroll with overflow content). */
export function findScrollParent(el) {
  let node = el?.parentElement
  while (node && node !== document.documentElement) {
    const { overflowY } = getComputedStyle(node)
    if (
      (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay')
      && node.scrollHeight > node.clientHeight + 1
    ) {
      return node
    }
    node = node.parentElement
  }
  return null
}

/** Scroll a child element to the top of a scroll container, or the page when the container does not scroll. */
export function scrollChildToTop(container, child, offset = 8) {
  if (!child) return

  const scroller = (container && container.scrollHeight > container.clientHeight + 1)
    ? container
    : findScrollParent(child)

  if (scroller) {
    const top = child.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop - offset
    scroller.scrollTo({ top: Math.max(0, top), behavior: 'smooth' })
    return
  }

  const top = child.getBoundingClientRect().top + window.scrollY - offset - STICKY_HEADER_OFFSET
  window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' })
}
