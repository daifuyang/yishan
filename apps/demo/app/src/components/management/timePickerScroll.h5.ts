/** WeUI uses touch-driven transforms, so native scrolling can be blocked throughout its modal. */
export function lockTimePickerScroll() {
  const scrollX = window.scrollX
  const scrollY = window.scrollY
  const elements = [document.documentElement, document.body,
    ...document.querySelectorAll<HTMLElement>('.taro_page')]
  const snapshots = elements.map((element) => ({ element, style: element.getAttribute('style') }))
  for (const element of elements) {
    element.style.overflow = 'hidden'
    element.style.overscrollBehavior = 'none'
  }
  Object.assign(document.body.style, {
    position: 'fixed', top: `${-scrollY}px`, left: `${-scrollX}px`, width: '100%',
  })
  const preventScroll = (event: TouchEvent) => {
    if (event.cancelable) event.preventDefault()
  }
  document.addEventListener('touchmove', preventScroll, { passive: false })
  let released = false
  return () => {
    if (released) return
    released = true
    document.removeEventListener('touchmove', preventScroll)
    for (const { element, style } of snapshots) {
      if (style === null) element.removeAttribute('style')
      else element.setAttribute('style', style)
    }
    window.scrollTo(scrollX, scrollY)
  }
}
